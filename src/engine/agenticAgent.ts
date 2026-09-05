/**
 * Autonomous Intervention Agent (Node/server-side mirror of src/agentic_agent.py)
 * =================================================================================
 * This runs only from server.ts (a Node/Express process), never in the browser
 * bundle — that boundary matters: an API key is safe to hold here and would
 * NOT be safe to hold in client-side React code, which is why the original
 * src/engine/* mirror never called a live LLM at all. @google/genai was
 * already a declared dependency (package.json) but unused anywhere in the
 * codebase until this file.
 *
 * Same design boundary as the Python version: the candidate menu, the TRAI
 * gate, the MDP stopping rule, the terminal halt, and the mandate execution
 * ceiling stay deterministic (computed in orchestrator.ts). The agent's
 * authority is scoped to choosing among an already-legal candidate set, and
 * a choice outside that set is discarded, falling through to the
 * deterministic fallback.
 */
import { GoogleGenAI } from '@google/genai';
import { ChannelType, FailureClassification } from './types';

export interface CandidateOption {
  strategyName: string;
  channel: ChannelType;
  expectedNetYieldPaise: number;
  successProbability: number;
  channelCostPaise: number;
}

export interface InterventionContext {
  entityId: string;
  classification: FailureClassification;
  attempt: number;
  amountInr: number;
  issuingBank?: string;
  candidates: CandidateOption[];
  mandateContext?: { npciAttemptsExhausted: boolean; inNpciExecutionWindow: boolean } | null;
  ptpStatus?: string | null;
  customerNote?: string | null;
}

export interface AgenticInterventionDecision {
  selectedStrategyName: string;
  reasoning: string;
  confidence: number;
  escalateToHuman: boolean;
  decisionSource: 'LLM_AGENT_GEMINI' | 'DETERMINISTIC_FALLBACK';
}

const AGENT_SYSTEM_PROMPT = `You are the Revive Autonomous Intervention Agent, a revenue-recovery decision agent
for an Indian payments platform. You choose exactly ONE recovery action for a single
at-risk payment event, from a fixed menu of pre-approved, policy-compliant candidate
actions supplied to you. You never invent an action outside that menu.

You will receive JSON describing: the failure classification, attempt number, amount,
issuing bank, any mandate-execution constraints, prior promise-to-pay status, and a list
of candidate options — each with a strategyName, channel, expected net recovery yield
in paise, success probability, and channel cost in paise.

Decision guidance:
- Prefer higher expected net yield, but override yield alone when a channel is a poor
  fit for the context: a B2B commercial receivable should not receive a casual consumer
  voice nudge; after repeated automated attempts, a corporate account is better served by
  escalation to a human Finance Ops contact than another automated message.
- If mandateContext.npciAttemptsExhausted is true, you MUST NOT select a candidate that
  re-attempts a silent mandate debit; NPCI's execution-attempt ceiling has been hit for
  this cycle, so prefer a consumer/human-facing candidate instead.
- Set escalateToHuman=true only when you select a HUMAN_ESCALATION channel candidate, or
  you judge the case now needs manual review beyond further automation.

Respond ONLY with a valid JSON object, no markdown, no commentary, matching exactly:
{
  "selectedStrategyName": "<one of the supplied candidate strategyName values, verbatim>",
  "reasoning": "<2-3 sentences, specific to this context, not generic>",
  "confidence": <float 0.0-1.0>,
  "escalateToHuman": <true|false>
}`;

function deterministicFallback(candidates: CandidateOption[]): AgenticInterventionDecision | null {
  if (candidates.length === 0) return null;
  const chosen = candidates[0];
  return {
    selectedStrategyName: chosen.strategyName,
    reasoning:
      'No LLM agent available or confident for this decision; applied the deterministic ' +
      'first-eligible-candidate policy as a fail-safe default.',
    confidence: 0.75,
    escalateToHuman: chosen.channel === ChannelType.HUMAN_ESCALATION,
    decisionSource: 'DETERMINISTIC_FALLBACK',
  };
}

function parseAndValidate(raw: string, candidates: CandidateOption[]): AgenticInterventionDecision | null {
  const validNames = new Set(candidates.map((c) => c.strategyName));
  try {
    let cleaned = raw.trim();
    if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    const data = JSON.parse(cleaned);
    const chosen = data.selectedStrategyName;
    if (!validNames.has(chosen)) {
      throw new Error(`Agent selected '${chosen}', outside legal candidate set [${[...validNames].join(', ')}]`);
    }
    return {
      selectedStrategyName: chosen,
      reasoning: String(data.reasoning || ''),
      confidence: Number(data.confidence ?? 0.85),
      escalateToHuman: Boolean(data.escalateToHuman ?? false),
      decisionSource: 'LLM_AGENT_GEMINI',
    };
  } catch (exc) {
    console.warn('[agenticAgent] Decision rejected, falling back:', (exc as Error).message);
    return null;
  }
}

let cachedClient: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

/**
 * Chooses one intervention from `context.candidates`. Returns a decision
 * whose selectedStrategyName is guaranteed to be one of the supplied
 * candidates' strategyName values, or null only when candidates is empty.
 */
export async function decideIntervention(context: InterventionContext): Promise<AgenticInterventionDecision | null> {
  if (context.candidates.length <= 1) {
    // Nothing to reason about; skip the LLM call entirely and take the sole option.
    return deterministicFallback(context.candidates);
  }

  const client = getClient();
  if (client) {
    try {
      const modelName = process.env.GEMINI_AGENT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const response = await client.models.generateContent({
        model: modelName,
        contents: JSON.stringify({
          entityId: context.entityId,
          classification: context.classification,
          attempt: context.attempt,
          amountInr: context.amountInr,
          issuingBank: context.issuingBank || null,
          mandateContext: context.mandateContext || null,
          ptpStatus: context.ptpStatus || null,
          customerNote: context.customerNote || null,
          candidates: context.candidates,
        }),
        config: { systemInstruction: AGENT_SYSTEM_PROMPT },
      });
      const raw = response.text || '';
      const decision = parseAndValidate(raw, context.candidates);
      if (decision) return decision;
      // falls through to deterministic fallback below
    } catch (exc) {
      console.warn('[agenticAgent] Gemini call failed, falling back:', (exc as Error).message);
    }
  }

  return deterministicFallback(context.candidates);
}
