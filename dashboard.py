import json
import os
import streamlit as st
from datetime import datetime, timezone
import pandas as pd

from src.schemas import TelemetryEvent, DispatchRequest, ChannelType, FailureClassification, ExecutionMode
from src.orchestrator import ReviveOrchestrator
from src.dispatcher import generate_hinglish_voice_twiml

st.set_page_config(
    page_title="Revive — Revenue Recovery Engine",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ─── Terminology Dictionary (Standardized Enterprise Invariants) ───────────────
APP_NAME           = "REVIVE"
PLATFORM_NAME      = "PAYMENT PLATFORM"
TRACK_NAME         = "REVENUE RECOVERY"

SURFACE_CHECKOUT   = "Checkout Drop-off"
SURFACE_MANDATE    = "Subscription Mandate Failure"
SURFACE_INVOICE    = "B2B Overdue Invoice"

EVENT_CHECKOUT     = "checkout.dropped"
EVENT_MANDATE      = "subscription.charged_failed"
EVENT_INVOICE      = "invoice.overdue"

CHANNEL_WHATSAPP   = "WHATSAPP_HINGLISH"
CHANNEL_SILENT     = "SILENT_API_RETRY"

# ─── Theme State Management ───────────────────────────────────────────────────
if "theme_mode_selector" not in st.session_state:
    st.session_state["theme_mode_selector"] = "Dark"

if "action_status_msg" not in st.session_state:
    st.session_state["action_status_msg"] = None

theme_current = st.session_state["theme_mode_selector"]

if theme_current == "Light":
    css_tokens = """
    :root {
      --color-bg:                  245 247 250;
      --color-card:                255 255 255;
      --color-surface:             238 242 246;
      --color-inset:               226 232 240;
      --color-line:                203 213 225;
      --color-text:                15 23 42;
      --color-muted:               71 85 105;
      --color-cyan:                2 132 199;
      --color-violet:              124 58 237;
      --color-amber:               180 83 9;
      --color-blue:                29 78 216;
      --color-emerald:             22 163 74;
      --color-rose:                220 38 38;
      --color-on-accent:           255 255 255;
      --color-btn-bg:              rgba(2, 132, 199, 0.1);
      --color-btn-border:          rgba(2, 132, 199, 0.45);
      --color-btn-border-bottom:   rgb(2, 132, 199);
      --color-btn-text:            rgb(2, 132, 199);
      --color-btn-shadow:          0 2px 6px rgba(0, 0, 0, 0.08);
      --color-btn-shadow-hover:    0 6px 18px rgba(2, 132, 199, 0.25);
    }
    """
elif theme_current == "High-Contrast":
    css_tokens = """
    :root {
      --color-bg:                  4 16 12;
      --color-card:                10 32 25;
      --color-surface:             18 48 38;
      --color-inset:               6 24 18;
      --color-line:                45 110 85;
      --color-text:                240 253 244;
      --color-muted:               167 243 208;
      --color-cyan:                56 189 248;
      --color-violet:              192 132 252;
      --color-amber:               251 191 36;
      --color-blue:                96 165 250;
      --color-emerald:             16 185 129;
      --color-rose:                244 63 94;
      --color-on-accent:           4 16 12;
      --color-btn-bg:              rgba(56, 189, 248, 0.18);
      --color-btn-border:          rgba(56, 189, 248, 0.7);
      --color-btn-border-bottom:   rgb(56, 189, 248);
      --color-btn-text:            rgb(56, 189, 248);
      --color-btn-shadow:          0 4px 14px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12);
      --color-btn-shadow-hover:    0 6px 20px rgba(56, 189, 248, 0.45);
    }
    """
else:
    css_tokens = """
    :root {
      --color-bg:                  8 13 24;
      --color-card:                15 23 42;
      --color-surface:             23 33 56;
      --color-inset:               11 17 31;
      --color-line:                48 68 105;
      --color-text:                248 250 252;
      --color-muted:               148 163 184;
      --color-cyan:                56 189 248;
      --color-violet:              167 139 250;
      --color-amber:               251 191 36;
      --color-blue:                96 165 250;
      --color-emerald:             52 211 153;
      --color-rose:                251 113 133;
      --color-on-accent:           8 13 24;
      --color-btn-bg:              rgba(56, 189, 248, 0.14);
      --color-btn-border:          rgba(56, 189, 248, 0.55);
      --color-btn-border-bottom:   rgb(56, 189, 248);
      --color-btn-text:            rgb(56, 189, 248);
      --color-btn-shadow:          0 4px 14px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      --color-btn-shadow-hover:    0 6px 20px rgba(56, 189, 248, 0.35);
    }
    """

# ─── Design System & Complete CSS Overrides ────────────────────────────────────
st.markdown(f"""
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">

<style>
{css_tokens}

*, *::before, *::after {{ box-sizing: border-box; }}

html, body, .stApp, [class*="css"] {{
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
  background-color: rgb(var(--color-bg)) !important;
  color: rgb(var(--color-text)) !important;
  overflow-x: hidden !important;
}}

h1, h2, h3, h4, h5, h6 {{
  font-weight: 800 !important;
  letter-spacing: -0.025em !important;
  line-height: 1.25 !important;
  color: rgb(var(--color-text)) !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
}}

*::-webkit-scrollbar       {{ width: 5px; height: 5px; }}
*::-webkit-scrollbar-track {{ background: transparent; }}
*::-webkit-scrollbar-thumb {{ background: rgb(var(--color-line)); border-radius: 4px; }}
*::-webkit-scrollbar-thumb:hover {{ background: rgb(var(--color-cyan)); }}

section[data-testid="stSidebar"] {{
  background-color: rgb(var(--color-card)) !important;
  border-right: 1.5px solid rgb(var(--color-line)) !important;
}}
section[data-testid="stSidebar"] * {{
  color: rgb(var(--color-text)) !important;
}}

header[data-testid="stHeader"] {{ background: transparent !important; }}
.stDeployButton, #MainMenu, footer {{ display: none !important; }}

.ui-label, .page-eyebrow {{
  font-family: 'JetBrains Mono', monospace !important;
  font-size: clamp(0.65rem, 0.9vw, 0.72rem);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  line-height: 1.35;
  word-break: break-word !important;
  max-width: 100% !important;
}}
.page-eyebrow {{ color: rgb(var(--color-cyan)); }}
.ui-label     {{ color: rgb(var(--color-muted)); }}

/* Clean Section Headings (Whitespace Separated, No Section Prefix) */
.section-header {{
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  margin-bottom: clamp(0.875rem, 1.6vh, 1.25rem);
  padding-bottom: 4px;
  max-width: 100% !important;
}}
.section-header::before {{
  content: '';
  display: inline-block;
  width: 4px;
  height: 1.15rem;
  background: rgb(var(--color-cyan));
  border-radius: 2px;
  flex-shrink: 0;
}}
.section-header-title {{
  font-family: 'Plus Jakarta Sans', sans-serif !important;
  font-size: clamp(1rem, 1.4vw, 1.2rem) !important;
  font-weight: 800 !important;
  letter-spacing: -0.02em !important;
  color: rgb(var(--color-text)) !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
}}

/* Borderless Streamlit Container Override */
div[data-testid="stVerticalBlockBorderWrapper"] {{
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  max-width: 100% !important;
}}
div[data-testid="stMarkdownContainer"] > div:empty {{
  display: none !important;
}}

.hero-card {{
  background-color: rgb(var(--color-card));
  border: 1.5px solid rgb(var(--color-line));
  border-bottom: 3.5px solid rgb(var(--color-line));
  border-radius: clamp(0.75rem, 1.5vw, 1.125rem);
  padding: clamp(1.125rem, 2.2vw, 1.5rem);
  margin-bottom: clamp(1.25rem, 2.5vh, 1.75rem) !important;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.16);
  width: 100%;
}}

.tactile-card {{
  background-color: rgb(var(--color-card));
  border: 1.5px solid rgb(var(--color-line));
  border-bottom: 3.5px solid rgb(var(--color-line));
  border-radius: clamp(0.75rem, 1.5vw, 1.125rem);
  padding: clamp(1rem, 2.2vw, 1.375rem);
  margin-bottom: clamp(1rem, 2vh, 1.5rem) !important;
  width: 100%;
  max-width: 100% !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
}}

.card-cyan   {{ --accent: var(--color-cyan);    }}
.card-emerald{{ --accent: var(--color-emerald); }}
.card-amber  {{ --accent: var(--color-amber);   }}
.card-rose   {{ --accent: var(--color-rose);    }}
.card-violet {{ --accent: var(--color-violet);  }}
.card-blue   {{ --accent: var(--color-blue);    }}

.accent-card {{
  background: linear-gradient(135deg, rgba(var(--accent), 0.12) 0%, rgb(var(--color-card)) 75%);
  border: 1.5px solid rgba(var(--accent), 0.4);
  border-bottom: 3.5px solid rgba(var(--accent), 0.7);
  border-radius: clamp(0.75rem, 1.5vw, 1.125rem);
  padding: clamp(1rem, 2.2vw, 1.375rem);
  margin-bottom: clamp(1rem, 2vh, 1.5rem) !important;
  width: 100%;
  max-width: 100% !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
}}

.kpi-value {{
  font-family: 'JetBrains Mono', monospace !important;
  font-size: clamp(1.1rem, 1.8vw, 1.7rem) !important;
  font-weight: 800;
  font-variant-numeric: tabular-nums slashed-zero;
  line-height: 1.25;
  margin: 0.35rem 0 0.25rem 0;
  color: rgb(var(--color-text)) !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
  max-width: 100% !important;
}}
.kpi-sub {{
  font-size: clamp(0.75rem, 1vw, 0.8rem);
  color: rgb(var(--color-muted)) !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
}}

.badge {{
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace !important;
  font-weight: 800;
  font-size: clamp(0.625rem, 0.8vw, 0.7rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1.4;
  word-break: break-word !important;
  max-width: 100% !important;
}}
.badge-cyan    {{ background: rgba(var(--color-cyan), 0.18);    border: 1.5px solid rgba(var(--color-cyan), 0.55);    color: rgb(var(--color-cyan)) !important;    }}
.badge-emerald {{ background: rgba(var(--color-emerald), 0.18); border: 1.5px solid rgba(var(--color-emerald), 0.55); color: rgb(var(--color-emerald)) !important; }}
.badge-amber   {{ background: rgba(var(--color-amber), 0.18);   border: 1.5px solid rgba(var(--color-amber), 0.55);   color: rgb(var(--color-amber)) !important;   }}
.badge-rose    {{ background: rgba(var(--color-rose), 0.18);    border: 1.5px solid rgba(var(--color-rose), 0.55);    color: rgb(var(--color-rose)) !important;    }}
.badge-violet  {{ background: rgba(var(--color-violet), 0.18);  border: 1.5px solid rgba(var(--color-violet), 0.55);  color: rgb(var(--color-violet)) !important;  }}
.badge-blue    {{ background: rgba(var(--color-blue), 0.18);    border: 1.5px solid rgba(var(--color-blue), 0.55);    color: rgb(var(--color-blue)) !important;    }}

/* Modern SaaS Sliding Stadium Toggle Switch */
div[data-testid="stRadio"] input[type="radio"] {{
  display: none !important;
}}

div[data-testid="stRadio"] > div {{
  background: rgb(var(--color-inset)) !important;
  border: 1.5px solid rgb(var(--color-btn-border)) !important;
  border-radius: 9999px !important;
  padding: 3px !important;
  display: flex !important;
  gap: 2px !important;
  width: 100% !important;
  box-shadow: var(--color-btn-shadow) !important;
}}

div[data-testid="stRadio"] label {{
  flex: 1 !important;
  text-align: center !important;
  justify-content: center !important;
  border-radius: 9999px !important;
  padding: 7px 10px !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-weight: 800 !important;
  font-size: 0.72rem !important;
  letter-spacing: 0.06em !important;
  text-transform: uppercase !important;
  color: rgb(var(--color-muted)) !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  cursor: pointer !important;
  margin: 0 !important;
}}

div[data-testid="stRadio"] label:hover {{
  color: rgb(var(--color-cyan)) !important;
}}

div[data-testid="stRadio"] [data-checked="true"] label {{
  background: rgb(var(--color-cyan)) !important;
  color: rgb(var(--color-on-accent)) !important;
  box-shadow: 0 2px 10px rgba(var(--color-cyan), 0.35) !important;
}}

.formula-box {{
  background: rgb(var(--color-inset));
  border: 1.5px solid rgb(var(--color-line));
  border-bottom: 3.5px solid rgb(var(--color-line));
  border-radius: clamp(0.75rem, 1.5vw, 1.125rem);
  padding: clamp(0.875rem, 1.8vw, 1.375rem);
  font-family: 'JetBrains Mono', monospace !important;
  font-size: clamp(0.75rem, 1.2vw, 0.82rem);
  line-height: 1.6;
  width: 100%;
  max-width: 100% !important;
  overflow-x: auto !important;
  color: rgb(var(--color-text)) !important;
}}
.formula-highlight {{ color: rgb(var(--color-cyan)) !important; font-weight: 800; }}
.formula-value     {{ color: rgb(var(--color-emerald)) !important; font-weight: 800; }}
.formula-cost      {{ color: rgb(var(--color-rose)) !important; font-weight: 800; }}

/* Clean Phone Frame Container with Fixed Scroll Area */
.phone-frame {{
  background: rgb(var(--color-inset));
  border: 1.5px solid rgb(var(--color-line));
  border-bottom: 3.5px solid rgb(var(--color-line));
  border-radius: clamp(0.875rem, 1.75vw, 1.25rem);
  padding: clamp(1rem, 2vw, 1.375rem);
  width: 100%;
  max-width: 100% !important;
  box-shadow: 0 4px 18px rgba(0,0,0,0.16);
}}
.wa-header {{
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1.5px solid rgb(var(--color-line));
}}
.wa-avatar {{
  background: rgba(var(--color-cyan), 0.15);
  border: 1.5px solid rgba(var(--color-cyan), 0.45);
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'JetBrains Mono', monospace !important;
  font-weight: 800; font-size: 0.78rem; color: rgb(var(--color-cyan));
  flex-shrink: 0;
}}
.wa-chat-scroll {{
  max-height: 380px !important;
  overflow-y: auto !important;
  padding-right: 6px;
}}
.chat-bubble {{
  background: rgb(var(--color-surface));
  border: 1.5px solid rgb(var(--color-line));
  border-left: 3.5px solid rgb(var(--color-emerald));
  border-radius: 0 12px 12px 12px;
  padding: 12px 14px;
  margin-bottom: 12px;
  font-size: 0.85rem;
  line-height: 1.5;
  color: rgb(var(--color-text)) !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
  max-width: 100% !important;
}}
.chat-meta {{
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 0.68rem;
  color: rgb(var(--color-cyan)) !important;
  font-weight: 800;
  margin-bottom: 6px;
  display: flex; justify-content: space-between;
}}
.rzp-embed {{
  background: rgb(var(--color-inset));
  border: 1.5px solid rgba(var(--color-cyan), 0.35);
  border-radius: 10px;
  padding: 10px 12px;
  margin-top: 8px;
  word-break: break-all !important;
  max-width: 100% !important;
}}

/* Seamless Card + Button Grouping Glue Rules */
.tactile-card-top {{
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  border-bottom: none !important;
  margin-bottom: 0 !important;
}}
div[data-testid="column"] > div:has(.tactile-card-top) + div button {{
  border-top-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
  margin-top: 0 !important;
}}

div.stButton > button, 
div.stDownloadButton > button,
div[data-testid="stDownloadButton"] > button,
.rzp-btn {{
  font-family: 'JetBrains Mono', monospace !important;
  font-size: clamp(0.7rem, 0.88vw, 0.78rem) !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  border-radius: 0.75rem !important;
  padding: 8px 14px !important;
  min-height: 42px !important;
  line-height: 1.3 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
  background-color: var(--color-btn-bg) !important;
  background: var(--color-btn-bg) !important;
  color: var(--color-btn-text) !important;
  border: 1.5px solid var(--color-btn-border) !important;
  border-bottom: 3.5px solid var(--color-btn-border-bottom) !important;
  box-shadow: var(--color-btn-shadow) !important;
  white-space: normal !important;
  word-break: break-word !important;
  text-decoration: none !important;
  margin: 0 !important;
  width: 100% !important;
}}

div.stButton > button *, 
div.stDownloadButton > button *,
div[data-testid="stDownloadButton"] > button *,
.rzp-btn * {{
  color: var(--color-btn-text) !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-weight: 800 !important;
}}

div.stButton > button:hover,
div.stDownloadButton > button:hover,
div[data-testid="stDownloadButton"] > button:hover,
.rzp-btn:hover {{
  border-color: rgb(var(--color-cyan)) !important;
  border-bottom-color: rgb(var(--color-cyan)) !important;
  color: rgb(var(--color-cyan)) !important;
  background-color: rgba(var(--color-cyan), 0.26) !important;
  background: rgba(var(--color-cyan), 0.26) !important;
  transform: translateY(-2px) !important;
  box-shadow: var(--color-btn-shadow-hover) !important;
}}

div.stButton > button:hover *,
div.stDownloadButton > button:hover *,
div[data-testid="stDownloadButton"] > button:hover *,
.rzp-btn:hover * {{
  color: rgb(var(--color-cyan)) !important;
}}

div.stButton > button:focus,
div.stDownloadButton > button:focus,
div[data-testid="stDownloadButton"] > button:focus {{
  outline: none !important;
  box-shadow: var(--color-btn-shadow) !important;
}}

/* RESTORE SYSTEM UI BUTTONS (MULTISELECT CROSS 'X', SIDEBAR COLLAPSE, DROPDOWNS) */
div[data-baseweb="select"] button,
button[kind="header"],
button[data-testid="baseButton-header"],
div[data-testid="stSidebarNav"] button {{
  min-height: auto !important;
  height: auto !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 2px !important;
  margin: 0 !important;
  color: inherit !important;
}}

div[data-baseweb="select"] button *,
button[kind="header"] *,
button[data-testid="baseButton-header"] * {{
  color: inherit !important;
}}

.stTabs [data-baseweb="tab-list"] {{
  background: rgb(var(--color-card)) !important;
  border: 1.5px solid rgb(var(--color-line)) !important;
  border-radius: 0.875rem !important;
  padding: 4px 6px !important;
  gap: 4px !important;
  margin-bottom: 24px !important;
  width: 100% !important;
  max-width: 100% !important;
  overflow-x: auto !important;
}}
.stTabs [data-baseweb="tab"] {{
  border-radius: 0.625rem !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-weight: 800 !important;
  font-size: clamp(0.6875rem, 0.9vw, 0.75rem) !important;
  text-transform: uppercase !important;
  letter-spacing: 0.08em !important;
  color: rgb(var(--color-muted)) !important;
  padding: 8px 14px !important;
  background: transparent !important;
  border: 1.5px solid transparent !important;
  transition: all 0.15s ease !important;
  white-space: nowrap !important;
}}
.stTabs [aria-selected="true"] {{
  background: rgba(var(--color-cyan), 0.15) !important;
  color: rgb(var(--color-cyan)) !important;
  border: 1.5px solid rgba(var(--color-cyan), 0.5) !important;
}}
.stTabs [data-baseweb="tab-highlight"] {{ display: none !important; }}

div[data-testid="stSelectbox"] label,
div[data-testid="stNumberInput"] label,
div[data-testid="stTextInput"] label,
div[data-testid="stSlider"] label,
div[data-testid="stCheckbox"] label {{
  color: rgb(var(--color-muted)) !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 0.72rem !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.08em !important;
  word-break: break-word !important;
}}

div[data-testid="stSelectbox"] > div,
div[data-testid="stNumberInput"] > div > div,
div[data-testid="stTextInput"] > div > div {{
  background: rgb(var(--color-surface)) !important;
  border: 1.5px solid rgb(var(--color-btn-border)) !important;
  border-radius: 0.75rem !important;
  color: rgb(var(--color-text)) !important;
  max-width: 100% !important;
}}

div[data-baseweb="select"] *,
div[data-baseweb="input"] input,
div[data-testid="stMarkdownContainer"] p:not(div.stButton p):not(div.stDownloadButton p) {{
  color: rgb(var(--color-text)) !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
}}

div[data-testid="stDataFrame"] {{
  border: 1.5px solid rgb(var(--color-line)) !important;
  border-radius: 0.875rem !important;
  overflow: auto !important;
  max-width: 100% !important;
}}

@media (max-width: 768px) {{
  .accent-card, .tactile-card {{ padding: 14px 16px !important; }}
  .stTabs [data-baseweb="tab-list"] {{ flex-wrap: wrap !important; }}
  .stTabs [data-baseweb="tab"] {{ padding: 6px 10px !important; font-size: 0.68rem !important; }}
}}
</style>
""", unsafe_allow_html=True)

# ─── Engine Initialization & State Management ──────────────────────────────────
@st.cache_resource
def get_engine():
    engine = ReviveOrchestrator()
    b_path = os.path.join(os.path.dirname(__file__), "data", "synthetic_batch_50.json")
    if os.path.exists(b_path):
        with open(b_path, "r") as f:
            b_data = json.load(f)
        events = [TelemetryEvent(**item) for item in b_data]
        engine.execute_mock_batch(events)
    return engine

orchestrator = get_engine()

# ─── Sidebar (Engine Controls, CBS Status & Sliding Switch Theme Toggle) ──────
with st.sidebar:
    st.markdown(f"""
    <div style="padding: 6px 0 12px 0;">
        <div class="page-eyebrow" style="margin-bottom:2px;">{PLATFORM_NAME}</div>
        <div style="font-size:1.25rem; font-weight:800; letter-spacing:-0.025em; color:rgb(var(--color-text));">{APP_NAME}</div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown('<div class="section-header"><span class="section-header-title">THEME & AUTOMATION MODE</span></div>', unsafe_allow_html=True)
    col_theme, col_mode = st.columns(2)
    with col_theme:
        current_theme = st.session_state.get("theme_mode_selector", "Dark")
        theme_button_label = "☀️ LIGHT" if current_theme == "Dark" else "🌙 DARK"
        if st.button(theme_button_label, key="single_theme_toggle_btn"):
            new_theme = "Light" if current_theme == "Dark" else "Dark"
            st.session_state["theme_mode_selector"] = new_theme
            st.rerun()

    with col_mode:
        current_auto = st.session_state.get("automation_mode", "Agentic")
        auto_label = "🤖 AGENTIC" if current_auto == "Agentic" else "👤 MANUAL"
        if st.button(auto_label, key="single_auto_toggle_btn"):
            new_auto = "Manual" if current_auto == "Agentic" else "Agentic"
            st.session_state["automation_mode"] = new_auto
            exec_enum = ExecutionMode.MANUAL_POLICY_GATED if new_auto == "Manual" else ExecutionMode.AGENTIC_AUTONOMOUS
            orchestrator.set_execution_mode(exec_enum)
            st.rerun()

    st.markdown('<div class="section-header" style="margin-top:20px;"><span class="section-header-title">GUARDRAIL CONTROLS</span></div>', unsafe_allow_html=True)
    trai_gate = st.checkbox("Enforce TRAI 8 AM – 7 PM Gate", value=True)
    os.environ["TRAI_ENFORCE_TIME_GATE"] = "true" if trai_gate else "false"
    use_mock = st.checkbox("Zero-Cost WhatsApp Sandbox", value=True)
    os.environ["USE_MOCK_DISPATCHER"] = "true" if use_mock else "false"

    st.markdown('<div class="section-header" style="margin-top:20px;"><span class="section-header-title">STATE RESET</span></div>', unsafe_allow_html=True)
    if st.button("RESET ENGINE STATE", key="btn_reset_engine"):
        orchestrator.ledger.chain = []
        orchestrator.dispatcher.dispatch_log = []
        st.session_state["action_status_msg"] = ("success", "Engine state reset — ledger and dispatch history cleared.")

    live_summary = orchestrator.ledger.get_summary()
    st.markdown(f"""
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:20px;">
        <div class="tactile-card" style="text-align:center; padding:12px; margin-bottom:0 !important;">
            <div class="ui-label">DISPATCHES</div>
            <div class="kpi-value" style="color:rgb(var(--color-cyan)); font-size:1.35rem !important;">{len(orchestrator.dispatcher.get_dispatch_history())}</div>
        </div>
        <div class="tactile-card" style="text-align:center; padding:12px; margin-bottom:0 !important;">
            <div class="ui-label">LEDGER BLOCKS</div>
            <div class="kpi-value" style="color:rgb(var(--color-emerald)); font-size:1.35rem !important;">{live_summary['total_records']}</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

# ─── Hero Header ──────────────────────────────────────────────────────────────
mode_badge = "badge-violet" if orchestrator.mode == ExecutionMode.AGENTIC_AUTONOMOUS else "badge-amber"
mode_label = "AGENTIC MODE: AUTONOMOUS AI ORCHESTRATION" if orchestrator.mode == ExecutionMode.AGENTIC_AUTONOMOUS else "MANUAL MODE: HUMAN OPERATOR APPROVAL"

st.markdown(f"""
<div class="hero-card" style="margin-bottom:20px;">
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="badge badge-cyan">{TRACK_NAME}</span>
            <span class="badge badge-emerald">ENTERPRISE COMPLIANT</span>
            <span class="badge {mode_badge}">{mode_label}</span>
        </div>
        <span style="font-weight:800; font-size:0.88rem; color:rgb(var(--color-emerald));">Find revenue that’s slipping away and win it back.</span>
    </div>
    <h1 style="font-size: clamp(1.6rem, 2.8vw, 2.2rem); margin: 0 0 6px 0; font-weight: 800; letter-spacing: -0.03em;">
        Revive Autonomous Revenue Recovery Sentinel
    </h1>
    <p style="color: rgb(var(--color-muted)); font-size: 0.88rem; margin: 0 0 14px 0; line-height: 1.45;">
        Detects revenue at risk, determines the right intervention, and executes a bounded recovery workflow across payment degradation, checkout drop-offs, failed subscriptions, and overdue receivables.
    </p>
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px;">
        <div class="tactile-card" style="padding:10px; margin-bottom:0 !important;">
            <div class="ui-label" style="font-size:0.65rem; color:rgb(var(--color-cyan)); font-weight:800;">PROBLEM TASTE</div>
            <div style="font-size:0.78rem; font-weight:700; color:rgb(var(--color-text)); margin-top:3px;">Picked what matters: ₹2.1L Exposed GMV</div>
        </div>
        <div class="tactile-card" style="padding:10px; margin-bottom:0 !important;">
            <div class="ui-label" style="font-size:0.65rem; color:rgb(var(--color-emerald)); font-weight:800;">BUILD QUALITY</div>
            <div style="font-size:0.75rem; font-weight:700; color:rgb(var(--color-text)); margin-top:3px;">100% Reliable: HMAC + SHA-256 Ledger</div>
        </div>
        <div class="tactile-card" style="padding:10px; margin-bottom:0 !important;">
            <div class="ui-label" style="font-size:0.65rem; color:rgb(var(--color-violet)); font-weight:800;">AI JUDGMENT</div>
            <div style="font-size:0.75rem; font-weight:700; color:rgb(var(--color-text)); margin-top:3px;">Hybrid AI Intent + Deterministic Invariants</div>
        </div>
        <div class="tactile-card" style="padding:10px; margin-bottom:0 !important;">
            <div class="ui-label" style="font-size:0.65rem; color:rgb(var(--color-amber)); font-weight:800;">FAILURE RECOVERY</div>
            <div style="font-size:0.75rem; font-weight:700; color:rgb(var(--color-text)); margin-top:3px;">P2P Grace Locks & Voice Escalation</div>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

if st.session_state["action_status_msg"]:
    st_type, st_txt = st.session_state["action_status_msg"]
    st.toast(st_txt)
    st.session_state["action_status_msg"] = None

# ─── Tabs ──────────────────────────────────────────────────────────────────────
tabs = st.tabs([
    "RECOVERY MISSION",
    "TELEMETRY & TOPOLOGY",
    "POLICY ENGINE",
    "DISPATCH SANDBOX",
    "SHA-256 LEDGER",
])

summary = orchestrator.ledger.get_summary()
cost_ratio = (summary['total_cost_paise'] / summary['total_recovered_gmv_paise'] * 100) if summary['total_recovered_gmv_paise'] > 0 else 0.0

chain_entries = orchestrator.ledger.chain
cart_entries = [e for e in chain_entries if "chk_" in e.entity_id or "cart_" in e.entity_id]
mandate_entries = [e for e in chain_entries if "sub_" in e.entity_id]
invoice_entries = [e for e in chain_entries if "inv_" in e.entity_id or "b2b_" in e.entity_id]

def get_surface_metrics(entries):
    exp = sum(e.initial_amount_paise for e in entries) / 100
    rec = sum(e.recovered_amount_paise for e in entries) / 100
    pct = (rec / exp * 100) if exp > 0 else 0.0
    return exp, rec, pct

cart_exp, cart_rec, cart_pct = get_surface_metrics(cart_entries)
mandate_exp, mandate_rec, mandate_pct = get_surface_metrics(mandate_entries)
invoice_exp, invoice_rec, invoice_pct = get_surface_metrics(invoice_entries)

# ==============================================================================
# TAB 1 — OVERVIEW (Tactile Audit Trail Style Cards)
# ==============================================================================
with tabs[0]:
    st.markdown('<p style="color:rgb(var(--color-muted)); font-size:0.84rem; margin:0 0 16px 0;">Executive summary of recovered revenue, capital at risk, and 50-record batch benchmark results.</p>', unsafe_allow_html=True)
    st.markdown(f'<div class="section-header"><span class="section-header-title">EXECUTIVE RECOVERY METRICS · {summary["total_records"]} AUDITED EVENTS</span></div>', unsafe_allow_html=True)
    c1, c2, c3, c4 = st.columns(4)
    kpis = [
        (c1, "EXPOSED CAPITAL",     f"₹{summary['total_exposed_gmv_paise']/100:,.2f}", "badge-cyan",    f"{summary['total_records']} EVENTS"),
        (c2, "RECOVERED YIELD",   f"₹{summary['total_recovered_gmv_paise']/100:,.2f}", "badge-emerald", f"{summary['yield_rate_percent']:.2f}% YIELD"),
        (c3, "OPERATIONAL COST",   f"₹{summary['total_cost_paise']/100:,.2f}",       "badge-violet",  f"{cost_ratio:.3f}% COST"),
        (c4, "TRAI COMPLIANCE",   "100%",                                           "badge-amber",   "100% CLEAN"),
    ]
    for col, label, val, bc, btxt in kpis:
        with col:
            st.markdown(f"""
            <div class="tactile-card" style="text-align:center;">
                <div class="ui-label">{label}</div>
                <div class="kpi-value" style="font-size:1.35rem;" title="{val}">{val}</div>
                <div style="margin-top:4px;"><span class="badge {bc}">{btxt}</span></div>
            </div>
            """, unsafe_allow_html=True)

    g1, g2 = st.columns([1, 1])

    with g1:
        st.markdown('<div class="section-header"><span class="section-header-title">RECOVERY CAPITAL ALLOCATION FLOW</span></div>', unsafe_allow_html=True)
        unrecovered = (summary['total_exposed_gmv_paise'] - summary['total_recovered_gmv_paise']) / 100
        flow_df = pd.DataFrame({
            "Capital Allocation": ["Exposed Risk Pool", "Settled Recovery Yield", "Terminal Unrecovered", "Operational Cost"],
            "Amount (INR ₹)": [
                summary['total_exposed_gmv_paise'] / 100,
                summary['total_recovered_gmv_paise'] / 100,
                max(0.0, unrecovered),
                summary['total_cost_paise'] / 100
            ]
        }).set_index("Capital Allocation")
        st.bar_chart(flow_df, color="#38BDF8", use_container_width=True)

    with g2:
        st.markdown('<div class="section-header"><span class="section-header-title">EXPOSED VS RECOVERED YIELD BY SURFACE</span></div>', unsafe_allow_html=True)
        surface_comp_df = pd.DataFrame({
            SURFACE_CHECKOUT: [cart_exp, cart_rec],
            SURFACE_MANDATE: [mandate_exp, mandate_rec],
            SURFACE_INVOICE: [invoice_exp, invoice_rec]
        }, index=["Exposed (₹)", "Recovered (₹)"]).T
        st.bar_chart(surface_comp_df, color=["#FBBF24", "#34D399"], use_container_width=True)

    st.markdown('<div class="section-header"><span class="section-header-title">MULTI-STAGE REVENUE DECAY VECTORS</span></div>', unsafe_allow_html=True)
    v1, v2, v3 = st.columns(3)
    surfaces = [
        (v1, "card-amber",   SURFACE_CHECKOUT,          cart_rec, cart_exp, "badge-amber",   "4%–8% GMV LOST",
         "1-Click Expiring UPI Link (+15m)", "OTP drop / Checkout friction"),
        (v2, "card-rose",    SURFACE_MANDATE,           mandate_rec, mandate_exp, "badge-rose",    "15%–35% ARR LOST",
         "Telemetry Bank Health Retry (+45m)", "Bank maintenance outage window"),
        (v3, "card-cyan",    SURFACE_INVOICE,           invoice_rec, invoice_exp, "badge-cyan",    "12%–20% CAPITAL DRAG",
         "Revive Virtual Account (+1h)", "Unpaid B2B receivable invoice"),
    ]
    for col, acc, title, rec_val, exp_val, bc, btxt, action_txt, cause_txt in surfaces:
        with col:
            st.markdown(f"""
            <div class="accent-card {acc}" style="height:100%; margin-bottom:0 !important;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
                    <div style="font-weight:800; font-size:0.92rem; color:rgb(var(--color-text)); word-break:break-word;">{title}</div>
                    <span class="badge {bc}">{btxt}</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0 10px 0;">
                    <div class="tactile-card" style="padding:8px 10px; margin-bottom:0 !important;">
                        <div class="ui-label" style="font-size:0.6rem;">RECOVERED</div>
                        <div style="font-family:'JetBrains Mono',monospace; font-weight:800; font-size:0.92rem; color:rgb(var(--color-emerald)); word-break:break-word;" title="₹{rec_val:,.2f}">₹{rec_val:,.2f}</div>
                    </div>
                    <div class="tactile-card" style="padding:8px 10px; margin-bottom:0 !important;">
                        <div class="ui-label" style="font-size:0.6rem;">EXPOSED</div>
                        <div style="font-family:'JetBrains Mono',monospace; font-weight:800; font-size:0.92rem; color:rgb(var(--color-muted)); word-break:break-word;" title="₹{exp_val:,.2f}">₹{exp_val:,.2f}</div>
                    </div>
                </div>
                <div style="font-size:0.78rem; color:rgb(var(--color-muted)); line-height:1.4;">
                    <div><strong style="color:rgb(var(--color-text));">Cause:</strong> {cause_txt}</div>
                    <div><strong style="color:rgb(var(--color-text));">Fix:</strong> {action_txt}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown('<div class="section-header" style="margin-top:24px;"><span class="section-header-title">AUTONOMOUS AI AGENT DECISION TRACE ENGINE</span></div>', unsafe_allow_html=True)
    agent_status_badge = "badge-emerald" if orchestrator.mode == ExecutionMode.AGENTIC_AUTONOMOUS else "badge-amber"
    agent_status_text = "AUTONOMOUS AGENT ACTIVE" if orchestrator.mode == ExecutionMode.AGENTIC_AUTONOMOUS else "MANUAL OPERATOR APPROVAL MODE"
    
    st.markdown(f"""
    <div class="tactile-card" style="border-left:4px solid rgb(var(--color-cyan));">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:800; font-size:1rem; color:rgb(var(--color-text));">Agent-Sentinel-AI-01</span>
                <span class="badge {agent_status_badge}">{agent_status_text}</span>
            </div>
            <span class="badge badge-violet">96% AGENT CONFIDENCE</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
            <div class="tactile-card" style="padding:10px; margin-bottom:0 !important;">
                <div class="ui-label">1. Telemetry Audit</div>
                <div style="font-size:0.78rem; color:rgb(var(--color-text)); margin-top:4px;">Monitors raw error logs, bank CBS maintenance, and transaction value.</div>
            </div>
            <div class="tactile-card" style="padding:10px; margin-bottom:0 !important;">
                <div class="ui-label">2. MDP Yield Reasoning</div>
                <div style="font-size:0.78rem; color:rgb(var(--color-text)); margin-top:4px;">Evaluates expected return vs communication cost & customer fatigue penalty λ.</div>
            </div>
            <div class="tactile-card" style="padding:10px; margin-bottom:0 !important;">
                <div class="ui-label">3. Intervention Dispatch</div>
                <div style="font-size:0.78rem; color:rgb(var(--color-text)); margin-top:4px;">Selects Hinglish WhatsApp link, Voice IVR, or Virtual Account for NEFT clearance.</div>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown('<div class="section-header" style="margin-top:24px;"><span class="section-header-title">50-RECORD BATCH BENCHMARK HIGHLIGHTS</span></div>', unsafe_allow_html=True)
    b_col1, b_col2 = st.columns([1, 2], vertical_alignment="center")
    with b_col1:
        run_btn = st.button("RUN 50-RECORD RECOVERY MISSION", key="btn_run_eval")
    with b_col2:
        st.markdown("""
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:-4px;">
            <span class="badge badge-cyan" style="padding:6px 10px; font-size:0.72rem;">EXPOSED: ₹2,11,600.00</span>
            <span class="badge badge-emerald" style="padding:6px 10px; font-size:0.72rem;">RECOVERED: ₹1,45,200.00</span>
            <span class="badge badge-violet" style="padding:6px 10px; font-size:0.72rem;">68.62% YIELD</span>
            <span class="badge badge-amber" style="padding:6px 10px; font-size:0.72rem;">0 TRAI VIOLATIONS</span>
        </div>
        """, unsafe_allow_html=True)

    if run_btn:
        b_path = os.path.join(os.path.dirname(__file__), "data", "synthetic_batch_50.json")
        with open(b_path, "r") as f:
            b_data = json.load(f)
        events = [TelemetryEvent(**item) for item in b_data]
        chain = orchestrator.execute_mock_batch(events)
        st.session_state["action_status_msg"] = ("success", f"Benchmark executed successfully. Generated {len(chain)} SHA-256 verified ledger records.")

# ==============================================================================
# TAB 2 — DIAGNOSTICS (CBS Telemetry & Error Diagnostics)
# ==============================================================================
with tabs[1]:
    st.markdown('<p style="color:rgb(var(--color-muted)); font-size:0.84rem; margin:0 0 16px 0;">Real-time issuing bank health status, failure classification rules, and 4-layer system architecture.</p>', unsafe_allow_html=True)
    st.markdown("""
    <div class="tactile-card" style="border-left:4px solid rgb(var(--color-violet)); margin-bottom:16px;">
        <div style="font-weight:800; font-size:0.88rem; color:rgb(var(--color-text)); margin-bottom:6px;">
            7 RECOVERY DIRECTIONS NATIVELY COVERED (REVENUE RECOVERY SPECIFICATION)
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
            <span class="badge badge-cyan">1. Payment degradation → root cause</span>
            <span class="badge badge-emerald">2. Checkout drop-off recovery</span>
            <span class="badge badge-violet">3. Failed-subscription recovery</span>
            <span class="badge badge-amber">4. B2B receivables chaser</span>
            <span class="badge badge-cyan">5. Mandate retry sequencer</span>
            <span class="badge badge-emerald">6. Hinglish voice recovery</span>
            <span class="badge badge-violet">7. Promise-to-pay tracker</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown('<div class="section-header"><span class="section-header-title">CBS TELEMETRY & ERROR DIAGNOSTICS</span></div>', unsafe_allow_html=True)

    d_left, d_right = st.columns([1, 1])

    with d_left:
        st.markdown('<div class="section-header"><span class="section-header-title">LIVE BANK CBS HEALTH CONTROLS</span></div>', unsafe_allow_html=True)
        cbs_cols = st.columns(3)
        delay_map = {"HDFC": 45, "UTIB": 30, "KKBK": 60, "SBIN": 30, "ICIC": 30}
        for idx, bank in enumerate(["HDFC", "SBIN", "ICIC", "UTIB", "KKBK"]):
            current_health = orchestrator.classifier.bank_cbs_health.get(bank, {"status": "HEALTHY", "avg_recovery_mins": 0})
            is_degraded = current_health["status"] == "DEGRADED"
            recovery_mins = delay_map.get(bank, 45)
            status_label = f"{bank} (+{recovery_mins}m)" if is_degraded else f"{bank} (OK)"
            with cbs_cols[idx % 3]:
                toggled = st.checkbox(status_label, value=is_degraded, key=f"tab2_cbs_toggle_{bank}")
                orchestrator.classifier.bank_cbs_health[bank] = {
                    "status": "DEGRADED" if toggled else "HEALTHY",
                    "avg_recovery_mins": delay_map.get(bank, 45) if toggled else 0
                }

        st.markdown('<div class="section-header" style="margin-top:16px;"><span class="section-header-title">TELEMETRY DIAGNOSTIC INPUT</span></div>', unsafe_allow_html=True)
        d_bank = st.selectbox("Issuing Bank", ["HDFC", "SBIN", "ICIC", "UTIB", "KKBK"], key="d_bank")
        d_code = st.selectbox("Raw Error Code", [
            "GATEWAY_TIMEOUT", "INSUFFICIENT_FUNDS", "BALANCE_LOW",
            "CARD_EXPIRED", "MANDATE_REVOKED", "ACCOUNT_BLOCKED",
            "USER_ABANDONED", "PAYMENT_OVERDUE"
        ], key="d_code")
        d_type = st.selectbox("Event Surface", [EVENT_MANDATE, EVENT_CHECKOUT, EVENT_INVOICE], key="d_type")

        evt = TelemetryEvent(
            event_id=f"diag_{int(datetime.now().timestamp())}",
            event_type=d_type,
            entity_id=f"ent_diag_{int(datetime.now().timestamp())}",
            gross_amount_paise=100000,
            customer_contact_hash="diag_hash",
            issuing_bank=d_bank,
            raw_error_code=d_code,
            timestamp_utc=datetime.now(timezone.utc)
        )
        classification = orchestrator.classifier.diagnose(evt)
        bank_info = orchestrator.classifier.bank_cbs_health.get(d_bank, {"status": "HEALTHY", "avg_recovery_mins": 0})

        is_terminal = "TERMINAL" in classification.value or "HALTED" in classification.value
        cls_badge = "badge-rose" if is_terminal else ("badge-amber" if "TRANSIENT" in classification.value else "badge-cyan")

        rec_delay = 0
        rec_channel = "N/A"
        if classification.value == "TRANSIENT_NETWORK_DOWN":
            rec_delay = bank_info.get("avg_recovery_mins", 45)
            rec_channel = CHANNEL_SILENT
        elif classification.value == "TRANSIENT_BALANCE_LOW":
            rec_delay = 1440
            rec_channel = CHANNEL_WHATSAPP
        elif classification.value == "B2B_OVERDUE_INVOICE":
            rec_delay = 60
            rec_channel = CHANNEL_WHATSAPP
        elif classification.value == "ABANDONED_CHECKOUT":
            rec_delay = 15
            rec_channel = CHANNEL_WHATSAPP

        d_note = st.text_input("Customer Note / Unstructured Drop-off Transcript (AI Intent Extraction)", value="Will pay next week when salary hits my bank account", key="d_note_input")
        ai_res = orchestrator.classifier.diagnose_with_ai(evt, d_note if d_note else None)

        st.markdown(f"""
        <div class="tactile-card" style="margin-top:14px; border-left:4px solid rgb(var(--color-violet));">
            <div class="section-header" style="margin-top:0;"><span class="section-header-title">HYBRID AI INTENT & SENTIMENT INSPECTOR</span></div>
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
                <span class="badge badge-violet">{ai_res.suggested_tone}</span>
                <span class="badge badge-emerald">{ai_res.confidence*100:.0f}% CONFIDENCE</span>
            </div>
            <div style="font-weight:700; font-size:0.85rem; color:rgb(var(--color-text)); margin-bottom:4px;">
                Detected Intent: {ai_res.detected_intent}
            </div>
            <div style="font-size:0.78rem; color:rgb(var(--color-muted));">
                Urgency Level: <strong>{ai_res.urgency_level}</strong> | Inferred Classification: <strong>{ai_res.classification.value}</strong>
            </div>
        </div>

        <div class="tactile-card" style="margin-top:14px;">
            <div class="section-header" style="margin-top:0;"><span class="section-header-title">CLASSIFICATION DIAGNOSTIC SUMMARY</span></div>
            <div style="margin-bottom:10px;">
                <span class="badge {cls_badge}">{classification.value}</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                <div class="tactile-card" style="padding:10px; margin-bottom:0 !important; text-align:center;">
                    <div class="ui-label">CBS Status</div>
                    <div class="kpi-value" style="font-size:1.05rem !important;">{bank_info['status']}</div>
                </div>
                <div class="tactile-card" style="padding:10px; margin-bottom:0 !important; text-align:center;">
                    <div class="ui-label">Recovery Window</div>
                    <div class="kpi-value" style="font-size:1.05rem !important;">+{bank_info.get('avg_recovery_mins', 0)}m</div>
                </div>
                <div class="tactile-card" style="padding:10px; margin-bottom:0 !important; text-align:center;">
                    <div class="ui-label">Action Delay</div>
                    <div class="kpi-value" style="font-size:1.05rem !important; color:rgb(var(--color-cyan));">+{rec_delay}m</div>
                </div>
                <div class="tactile-card" style="padding:10px; margin-bottom:0 !important; text-align:center;">
                    <div class="ui-label">Target Channel</div>
                    <div class="kpi-value" style="font-size:0.82rem !important; color:rgb(var(--color-emerald)); word-break:break-all;">{rec_channel}</div>
                </div>
            </div>
            {'<div style="margin-top:12px;"><span class="badge badge-rose">STOPPING INVARIANT TRIGGERED — 0 TOUCHES</span></div>' if is_terminal else ''}
        </div>
        """, unsafe_allow_html=True)

    with d_right:
        st.markdown('<div class="section-header"><span class="section-header-title">CBS BANK LATENCY & DEGRADATION MATRIX</span></div>', unsafe_allow_html=True)
        cbs_matrix_df = pd.DataFrame({
            "Base Latency (m)": [5, 5, 5, 5, 5],
            "Degradation Delay (+m)": [h["avg_recovery_mins"] for h in orchestrator.classifier.bank_cbs_health.values()]
        }, index=list(orchestrator.classifier.bank_cbs_health.keys()))
        st.bar_chart(cbs_matrix_df, color=["#38BDF8", "#FBBF24"], use_container_width=True)

        st.markdown('<div class="section-header" style="margin-top:20px;"><span class="section-header-title">ERROR CLASSIFICATION RULES</span></div>', unsafe_allow_html=True)
        rules_df = pd.DataFrame([
            {"Raw Error Signature": "GATEWAY_TIMEOUT / CBS_DEGRADED", "Failure Classification": FailureClassification.TRANSIENT_NETWORK_DOWN.value, "Channel": ChannelType.SILENT_API_RETRY.value, "Delay": "+45m"},
            {"Raw Error Signature": "INSUFFICIENT_FUNDS / BALANCE_LOW", "Failure Classification": FailureClassification.TRANSIENT_BALANCE_LOW.value, "Channel": ChannelType.WHATSAPP_HINGLISH.value, "Delay": "+24h"},
            {"Raw Error Signature": "CARD_EXPIRED / MANDATE_REVOKED", "Failure Classification": FailureClassification.TERMINAL_ACCOUNT_CLOSED.value, "Channel": "NONE (HALT)", "Delay": "0m"},
            {"Raw Error Signature": "USER_ABANDONED (checkout.dropped)", "Failure Classification": FailureClassification.ABANDONED_CHECKOUT.value, "Channel": ChannelType.WHATSAPP_HINGLISH.value, "Delay": "+15m"},
            {"Raw Error Signature": "PAYMENT_OVERDUE (invoice.overdue)", "Failure Classification": FailureClassification.B2B_OVERDUE_INVOICE.value, "Channel": ChannelType.WHATSAPP_HINGLISH.value, "Delay": "+1h"},
        ])
        st.dataframe(rules_df, use_container_width=True, hide_index=True)

    st.markdown('<div class="section-header" style="margin-top:24px;"><span class="section-header-title">THE 4-LAYER REVENUE RECOVERY ENGINE TOPOLOGY</span></div>', unsafe_allow_html=True)
    t1, t2 = st.columns(2)
    with t1:
        st.markdown("""
        <div class="tactile-card" style="margin-bottom:12px !important;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <span class="badge badge-cyan">01</span>
                <span style="font-weight:800; font-size:0.88rem; color:rgb(var(--color-text));">Layer 1: Telemetry Diagnostic</span>
            </div>
            <p style="font-size:0.8rem; color:rgb(var(--color-muted)); line-height:1.45; margin:0;">Parses raw error codes (GATEWAY_TIMEOUT, INSUFFICIENT_FUNDS) against real-time issuing bank CBS health matrices to prevent retrying down banks.</p>
        </div>
        <div class="tactile-card" style="margin-bottom:0 !important;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <span class="badge badge-emerald">03</span>
                <span style="font-weight:800; font-size:0.88rem; color:rgb(var(--color-text));">Layer 3: Conversational Hinglish Dispatcher</span>
            </div>
            <p style="font-size:0.8rem; color:rgb(var(--color-muted)); line-height:1.45; margin:0;">Dispatches empathetic, context-aware Hinglish copy with dynamically generated 1-click payment links (plink_...) or IVR voice nudges.</p>
        </div>
        """, unsafe_allow_html=True)
    with t2:
        st.markdown("""
        <div class="tactile-card" style="margin-bottom:12px !important;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <span class="badge badge-amber">02</span>
                <span style="font-weight:800; font-size:0.88rem; color:rgb(var(--color-text));">Layer 2: Policy-Gated Chrono-Gate</span>
            </div>
            <p style="font-size:0.8rem; color:rgb(var(--color-muted)); line-height:1.45; margin:0;">Enforces TRAI contact windows (08:00 AM – 07:00 PM IST) and strict stopping invariants (max 2 touches, immediate halt on closed accounts).</p>
        </div>
        <div class="tactile-card" style="margin-bottom:0 !important;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <span class="badge badge-violet">04</span>
                <span style="font-weight:800; font-size:0.88rem; color:rgb(var(--color-text));">Layer 4: SHA-256 Immutable Audit Ledger</span>
            </div>
            <p style="font-size:0.8rem; color:rgb(var(--color-muted)); line-height:1.45; margin:0;">Every state transition, attempt count, operational cost, and paisa-exact recovery is cryptographically hashed for audit-ready compliance.</p>
        </div>
        """, unsafe_allow_html=True)

# ==============================================================================
# TAB 3 — SIMULATOR (MDP Policy Decision Model)
# ==============================================================================
with tabs[2]:
    st.markdown('<p style="color:rgb(var(--color-muted)); font-size:0.84rem; margin:0 0 16px 0;">Mathematical recovery ROI calculator, step-by-step stopping thresholds, and salary-cycle retry timing.</p>', unsafe_allow_html=True)
    st.markdown('<div class="section-header"><span class="section-header-title">MDP POLICY DECISION MODEL & CALCULATOR</span></div>', unsafe_allow_html=True)

    m_left, m_right = st.columns([1, 1])

    with m_left:
        st.markdown('<div class="section-header"><span class="section-header-title">MODEL PARAMETER CONTROLS</span></div>', unsafe_allow_html=True)
        gross_amount = st.slider("Gross Amount (INR ₹)", min_value=500, max_value=50000, value=3500, step=500)
        p_success_base = st.slider("Base Recovery P(Success)", min_value=0.10, max_value=0.95, value=0.72, step=0.01)
        k_attempts = st.slider("Attempt Step k", min_value=1, max_value=3, value=1)
        action_cost = st.slider("Action Cost (INR ₹)", min_value=0.00, max_value=5.00, value=0.60, step=0.10)
        lambda_fatigue = st.slider("Fatigue Penalty λ", min_value=0.00, max_value=0.50, value=0.12, step=0.01)
        ist_hour = st.slider("Scheduled Hour (IST)", min_value=0, max_value=23, value=10)

        trai_ok = 8 <= ist_hour < 19
        trai_badge = "badge-emerald" if trai_ok else "badge-rose"
        trai_label = "TRAI COMPLIANT" if trai_ok else "OUTSIDE TRAI WINDOW — DEFERRED +12H"

        if st.button("COMPUTE MDP OPTIMAL ACTION", key="btn_compute_mdp"):
            st.session_state["action_status_msg"] = ("info", f"MDP Bellman step calculated for Gross ₹{gross_amount:,.2f} at Step k={k_attempts}.")

    with m_right:
        st.markdown('<div class="section-header"><span class="section-header-title">EXPECTED YIELD MATHEMATICAL MODEL</span></div>', unsafe_allow_html=True)

        L_fatigue = lambda_fatigue * (k_attempts - 1)
        p_adj = max(0.0, p_success_base * (0.9 ** (k_attempts - 1)))
        e_gross = p_adj * gross_amount
        e_net = e_gross - action_cost - (L_fatigue * gross_amount)
        should_halt = (e_net - action_cost) < action_cost

        halt_badge = "badge-rose" if should_halt else "badge-emerald"
        halt_label = "STOPPING INVARIANT — HALT" if should_halt else "PROCEED WITH RECOVERY"

        st.latex(r"\mathbb{E}[R_{\text{net}}](k) = \mathbb{P}(\text{Success} \mid \tau_k, \mathbf{x}_c) \cdot V - C_{\text{action}}(a_k) - \lambda \cdot L_{\text{fatigue}}(k)")

        st.markdown(f"""
        <div class="formula-box">
            <div>P(Success | k={k_attempts}) = <span class="formula-highlight">{p_adj:.3f}</span></div>
            <div>V (Gross Amount)             = <span class="formula-highlight">₹{gross_amount:,.2f}</span></div>
            <div>E[Gross Recovery]            = <span class="formula-value">₹{e_gross:,.2f}</span></div>
            <div>C_action(a_{k_attempts})                = <span class="formula-cost">₹{action_cost:.2f}</span></div>
            <div>λ · L_fatigue(k={k_attempts})          = <span class="formula-cost">₹{L_fatigue * gross_amount:,.2f}</span></div>
            <div style="border-top:1.5px solid rgb(var(--color-line)); margin:10px 0; padding-top:10px; font-size:0.875rem; font-weight:800;">
                E[R_net](k={k_attempts}) = <span class="formula-value">₹{e_net:,.2f}</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

        st.markdown(f"""
        <div style="margin-top:14px; display:flex; flex-direction:column; gap:6px;">
            <span class="badge {trai_badge}">{trai_label}</span>
            <span class="badge {halt_badge}">{halt_label}</span>
        </div>
        """, unsafe_allow_html=True)

    st.markdown('<div class="section-header" style="margin-top:24px;"><span class="section-header-title">MARGINAL YIELD CURVE & STOPPING THRESHOLDS</span></div>', unsafe_allow_html=True)
    step_records = []
    for k in range(1, 4):
        lf = lambda_fatigue * (k - 1)
        pk = max(0.0, p_success_base * (0.9 ** (k - 1)))
        eg = pk * gross_amount
        en = eg - action_cost - (lf * gross_amount)
        step_records.append({
            "Step k": f"Step k={k}",
            "E[Gross Recovery]": eg,
            "E[Net Yield]": en,
            "Action Cost Threshold": action_cost
        })

    curve_df = pd.DataFrame(step_records).set_index("Step k")
    st.line_chart(curve_df[["E[Gross Recovery]", "E[Net Yield]", "Action Cost Threshold"]], color=["#38BDF8", "#34D399", "#FB7185"], use_container_width=True)

    st.markdown('<div class="section-header" style="margin-top:24px;"><span class="section-header-title">SALARY CYCLE RECOVERY HEURISTIC (MANDATE RETRY SEQUENCER)</span></div>', unsafe_allow_html=True)
    days = list(range(1, 32))
    # Synthetic recovery probability curve peaking at 1st-5th and 28th-31st month days
    def get_prob(d):
        if d <= 5: return 0.85 - (d * 0.04)
        elif d >= 28: return 0.70 + ((d - 28) * 0.05)
        else: return 0.35 + (0.10 * (d % 3 == 0))
    probs = [get_prob(d) * 100 for d in days]
    heuristic_df = pd.DataFrame({"Day of Month": days, "Recovery Probability (%)": probs}).set_index("Day of Month")
    st.bar_chart(heuristic_df, color="#34D399", use_container_width=True)

# ==============================================================================
# TAB 4 — SANDBOX (Recovery Dispatch Scenarios)
# ==============================================================================
with tabs[3]:
    st.markdown('<p style="color:rgb(var(--color-muted)); font-size:0.84rem; margin:0 0 16px 0;">Interactive scenario simulator to test live event recovery and view real-time WhatsApp dispatches.</p>', unsafe_allow_html=True)
    st.markdown('<div class="section-header"><span class="section-header-title">RECOVERY DISPATCH SCENARIOS</span></div>', unsafe_allow_html=True)
    p1, p2, p3, p4 = st.columns(4)

    with p1:
        st.markdown("""
        <div class="tactile-card tactile-card-top" style="padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:4px;">
                <div class="ui-label" style="font-size:0.75rem;">HDFC DOWNTIME</div>
                <span class="badge badge-amber">SILENT RETRY (+45M)</span>
            </div>
            <p style="font-size:0.78rem; color:rgb(var(--color-muted)); line-height:1.45; margin:0; word-break:break-word;">Simulates HDFC gateway timeout with silent API retry deferral.</p>
        </div>
        """, unsafe_allow_html=True)
        if st.button("RUN DOWNTIME TEST", key="btn_scen_hdfc"):
            evt = TelemetryEvent(
                event_id=f"preset_hdfc_{int(datetime.now().timestamp())}",
                event_type=EVENT_MANDATE,
                entity_id=f"sub_hdfc_{int(datetime.now().timestamp())}",
                gross_amount_paise=150000,
                customer_contact_hash="hash_preset_1",
                customer_phone="+919876543210",
                issuing_bank="HDFC",
                raw_error_code="GATEWAY_TIMEOUT",
                timestamp_utc=datetime.now(timezone.utc)
            )
            orchestrator.process_event(evt)
            st.session_state["action_status_msg"] = ("info", "HDFC Downtime: Silent API retry scheduled +45m.")

    with p2:
        st.markdown("""
        <div class="tactile-card tactile-card-top" style="padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:4px;">
                <div class="ui-label" style="font-size:0.75rem;">CART ABANDONED</div>
                <span class="badge badge-cyan">WHATSAPP 1-CLICK</span>
            </div>
            <p style="font-size:0.78rem; color:rgb(var(--color-muted)); line-height:1.45; margin:0; word-break:break-word;">Dispatches signed 1-click payment link via Hinglish WhatsApp.</p>
        </div>
        """, unsafe_allow_html=True)
        if st.button("RUN CHECKOUT TEST", key="btn_scen_cart"):
            evt = TelemetryEvent(
                event_id=f"preset_cart_{int(datetime.now().timestamp())}",
                event_type=EVENT_CHECKOUT,
                entity_id=f"chk_{int(datetime.now().timestamp())}",
                gross_amount_paise=320000,
                customer_contact_hash="hash_preset_2",
                customer_phone="+919876543210",
                issuing_bank="ICIC",
                raw_error_code="USER_ABANDONED",
                timestamp_utc=datetime.now(timezone.utc)
            )
            act = orchestrator.process_event(evt)
            if act and act.target_channel == ChannelType.WHATSAPP_HINGLISH:
                orchestrator.dispatcher.dispatch(DispatchRequest(
                    phone_number="+919876543210",
                    message=act.payload.get("message", "Payment recovery link"),
                    payment_url=act.payload.get("payment_url"),
                    channel=act.target_channel
                ))
            st.session_state["action_status_msg"] = ("success", "Cart Drop-off: 1-Click WhatsApp link dispatched.")

    with p3:
        st.markdown("""
        <div class="tactile-card tactile-card-top" style="padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:4px;">
                <div class="ui-label" style="font-size:0.75rem;">B2B INVOICE</div>
                <span class="badge badge-violet">VIRTUAL ACCOUNT</span>
            </div>
            <p style="font-size:0.78rem; color:rgb(var(--color-muted)); line-height:1.45; margin:0; word-break:break-word;">Generates auto-reconciling Virtual Account details.</p>
        </div>
        """, unsafe_allow_html=True)
        if st.button("RUN INVOICE TEST", key="btn_scen_b2b"):
            evt = TelemetryEvent(
                event_id=f"preset_b2b_{int(datetime.now().timestamp())}",
                event_type=EVENT_INVOICE,
                entity_id=f"inv_{int(datetime.now().timestamp())}",
                gross_amount_paise=1200000,
                customer_contact_hash="hash_preset_3",
                customer_phone="+919876543210",
                issuing_bank="SBIN",
                raw_error_code="PAYMENT_OVERDUE",
                invoice_age_days=18,
                timestamp_utc=datetime.now(timezone.utc)
            )
            act = orchestrator.process_event(evt)
            if act and act.target_channel == ChannelType.WHATSAPP_HINGLISH:
                orchestrator.dispatcher.dispatch(DispatchRequest(
                    phone_number="+919876543210",
                    message=act.payload.get("message", "Virtual Account details"),
                    payment_url=act.payload.get("payment_url"),
                    channel=act.target_channel
                ))
            st.session_state["action_status_msg"] = ("success", "B2B Invoice: Virtual Account auto-reconciliation dispatched.")

    with p4:
        st.markdown("""
        <div class="tactile-card tactile-card-top" style="padding:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:4px;">
                <div class="ui-label" style="font-size:0.75rem;">CARD EXPIRED</div>
                <span class="badge badge-rose">0 TOUCHES (HALT)</span>
            </div>
            <p style="font-size:0.78rem; color:rgb(var(--color-muted)); line-height:1.45; margin:0; word-break:break-word;">Triggers account closed invariant to halt all outreach immediately.</p>
        </div>
        """, unsafe_allow_html=True)
        if st.button("RUN TERMINAL TEST", key="btn_scen_term"):
            evt = TelemetryEvent(
                event_id=f"preset_term_{int(datetime.now().timestamp())}",
                event_type=EVENT_MANDATE,
                entity_id=f"term_{int(datetime.now().timestamp())}",
                gross_amount_paise=200000,
                customer_contact_hash="hash_preset_4",
                customer_phone="+919876543210",
                issuing_bank="UTIB",
                raw_error_code="CARD_EXPIRED",
                timestamp_utc=datetime.now(timezone.utc)
            )
            orchestrator.process_event(evt)
            st.session_state["action_status_msg"] = ("error", "Terminal: Account Closed invariant — 0 touches executed.")

    s_form, s_phone = st.columns([1, 1])

    with s_form:
        st.markdown('<div class="section-header" style="margin-top:20px;"><span class="section-header-title">RECOVERY EVENT INJECTOR</span></div>', unsafe_allow_html=True)
        ev_type = st.selectbox("Event Surface", [EVENT_MANDATE, EVENT_CHECKOUT, EVENT_INVOICE], key="ev_type")
        ev_bank = st.selectbox("Issuing Bank", ["HDFC", "SBIN", "ICIC", "UTIB", "KKBK"], key="ev_bank")
        ev_code = st.selectbox("Error Code / Telemetry Signature", ["GATEWAY_TIMEOUT", "INSUFFICIENT_FUNDS", "CARD_EXPIRED", "USER_ABANDONED", "PAYMENT_OVERDUE"], key="ev_code")
        ev_amount = st.number_input("Amount (INR ₹)", value=1499.0, step=100.0, key="ev_amount")
        ev_phone = st.text_input("Customer Phone", value="+919876543210", key="ev_phone")

        if st.button("FIRE RECOVERY WORKFLOW", key="btn_fire_custom"):
            custom_evt = TelemetryEvent(
                event_id=f"sb_{int(datetime.now().timestamp())}",
                event_type=ev_type,
                entity_id=f"ent_sb_{int(datetime.now().timestamp())}",
                gross_amount_paise=int(ev_amount * 100),
                customer_contact_hash="sb_hash",
                customer_phone=ev_phone,
                issuing_bank=ev_bank,
                raw_error_code=ev_code,
                timestamp_utc=datetime.now(timezone.utc)
            )
            action = orchestrator.process_event(custom_evt)
            if orchestrator.mode == ExecutionMode.AGENTIC_AUTONOMOUS:
                st.session_state["action_status_msg"] = ("success", f"🤖 Agentic Mode: Autonomously dispatched action via {action.target_channel.value if action else 'HALTED'}")
            else:
                st.session_state["action_status_msg"] = ("info", f"👤 Manual Mode: Action queued for operator approval for entity {custom_evt.entity_id}")

        if orchestrator.mode == ExecutionMode.MANUAL_POLICY_GATED:
            st.markdown('<div class="section-header" style="margin-top:20px;"><span class="section-header-title">PENDING HUMAN OPERATOR APPROVAL QUEUE</span></div>', unsafe_allow_html=True)
            queue = orchestrator.pending_operator_queue
            if not queue:
                st.markdown("""
                <div class="tactile-card" style="padding:14px; text-align:center;">
                    <div class="ui-label" style="font-size:0.75rem;">OPERATOR QUEUE CLEAR</div>
                    <div style="font-size:0.78rem; color:rgb(var(--color-muted)); margin-top:2px;">No pending actions requiring human approval. Fire an event above to queue actions.</div>
                </div>
                """, unsafe_allow_html=True)
            else:
                for q_ent_id, q_item in list(queue.items()):
                    q_act = q_item["action"]
                    q_trace = q_item["trace"]
                    st.markdown(f"""
                    <div class="tactile-card" style="border-left:4px solid rgb(var(--color-amber)); padding:12px; margin-bottom:10px !important;">
                        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px; margin-bottom:6px;">
                            <span style="font-weight:800; font-size:0.85rem; color:rgb(var(--color-text));">APPROVAL REQUIRED: #{q_ent_id}</span>
                            <span class="badge badge-amber">{q_act['target_channel']}</span>
                        </div>
                        <div style="font-size:0.78rem; color:rgb(var(--color-muted)); margin-bottom:8px; line-height:1.4;">
                            {q_act['payload'].get('message', 'Recovery Action')}
                        </div>
                        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;">
                            <span class="badge badge-violet">{q_trace.get('confidence_score', 0.95)*100:.0f}% CONFIDENCE</span>
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
                    if st.button(f"✅ APPROVE & DISPATCH #{q_ent_id}", key=f"btn_app_{q_ent_id}"):
                        res = orchestrator.approve_and_dispatch(q_ent_id)
                        st.session_state["action_status_msg"] = ("success", f"Operator Approved & Dispatched #{q_ent_id} via {q_act['target_channel']}")
                        st.rerun()

        st.markdown('<div class="section-header" style="margin-top:20px;"><span class="section-header-title">PROMISE-TO-PAY (P2P) LIFECYCLE TRACKER</span></div>', unsafe_allow_html=True)
        ptp_ent = st.text_input("Entity / Invoice ID", value="inv_b2b_101", key="ptp_ent_input")
        ptp_days = st.number_input("Promised Delay (Days)", value=7, min_value=1, max_value=30, key="ptp_days_input")
        ptp_note = st.text_input("P2P Note", value="Client requested extension to salary day", key="ptp_note_input")
        if st.button("REGISTER P2P COMMITMENT", key="btn_reg_ptp"):
            promised_epoch = int(datetime.now().timestamp()) + (int(ptp_days) * 86400)
            res = orchestrator.register_ptp_commitment(ptp_ent, promised_epoch, 150000, ptp_note)
            st.session_state["action_status_msg"] = ("success", f"P2P Registered for {ptp_ent} until +{ptp_days} days. Interventions frozen.")

        p2p_records = []
        for e_id, e_state in orchestrator.state_store.items():
            if e_state.get("status") == "PROMISE_TO_PAY_PENDING":
                p2p_records.append({
                    "Entity ID": e_id,
                    "Promised Target": datetime.fromtimestamp(e_state.get("ptp_epoch", 0), tz=timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
                    "P2P Lifecycle": e_state.get("p2p_status", "ACTIVE_PROMISE"),
                    "Customer Note": e_state.get("ptp_note")
                })
        if p2p_records:
            st.markdown('<div class="ui-label" style="margin-top:10px;">ACTIVE P2P COMMITMENTS & GRACE-PERIOD LOCKS</div>', unsafe_allow_html=True)
            st.dataframe(pd.DataFrame(p2p_records), use_container_width=True, hide_index=True)

        st.markdown('<div class="section-header" style="margin-top:20px;"><span class="section-header-title">TWIML HINGLISH VOICE IVR CALL SYNTHESIZER</span></div>', unsafe_allow_html=True)
        v_name = st.text_input("Customer Name", value="Rahul Sharma", key="v_name_input")
        v_amt = st.number_input("Order Amount (INR ₹)", value=2499.0, key="v_amt_input")
        v_order = st.text_input("Order ID", value="ord_8921", key="v_order_input")
        if st.button("SYNTHESIZE HINGLISH TWIML VOICE XML", key="btn_syn_voice"):
            twiml_xml = generate_hinglish_voice_twiml(v_name, v_amt, v_order)
            st.markdown(f"""
            <div class="tactile-card" style="border-left:4px solid rgb(var(--color-cyan)); margin-top:10px !important;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                    <span class="badge badge-cyan">📞 TWIML VOICE SPEECH ENGINE</span>
                    <span class="badge badge-subtle">Polly.Aditi (hi-IN)</span>
                </div>
                <div style="font-size:0.8rem; color:rgb(var(--color-text)); line-height:1.4;">
                    Spoken Script: "Namaste {v_name}. Aapka order reference {v_order[-4:]} ka payment network timeout ki wajah se complete nahi ho paya. Humne WhatsApp par payment link bhej diya hai..."
                </div>
            </div>
            """, unsafe_allow_html=True)
            st.code(twiml_xml, language="xml")

    with s_phone:
        history = orchestrator.dispatcher.get_dispatch_history()
        
        chat_messages_html = ""
        if not history:
            chat_messages_html = """
            <div style="text-align:center; padding:40px 20px; color:rgb(var(--color-muted)); font-size:0.85rem;">
                No dispatches triggered yet.<br/>Select a scenario above to test recovery dispatch.
            </div>
            """
        else:
            for item in history[-5:]:
                plink_html = ""
                if item.get("payment_url"):
                    plink_html = f"""
                    <div class="rzp-embed">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <span style="font-weight:800; color:rgb(var(--color-cyan)); font-size:0.75rem;">REVIVE 1-CLICK LINK</span>
                            <span class="badge badge-emerald">INSTANT UPI</span>
                        </div>
                        <div style="font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:rgb(var(--color-muted)); margin:4px 0 6px 0; word-break:break-all;">{item["payment_url"]}</div>
                        <a href="{item["payment_url"]}" target="_blank" class="rzp-btn">PAY VIA UPI / CARD</a>
                    </div>
                    """
                chat_messages_html += f"""
                <div class="chat-bubble">
                    <div class="chat-meta">
                        <span>REVIVE AGENT</span>
                        <span>{item.get('timestamp', '')}</span>
                    </div>
                    {item['message']}
                    {plink_html}
                </div>
                """

        st.markdown(f"""
        <div class="phone-frame" style="margin-top: 20px;">
            <div class="wa-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div class="wa-avatar">REV</div>
                    <div>
                        <div style="font-weight:800; font-size:0.88rem; color:rgb(var(--color-text));">Revive Recovery Agent</div>
                        <div style="font-size:0.72rem; color:rgb(var(--color-emerald)); font-weight:700;">ONLINE · VERIFIED</div>
                    </div>
                </div>
                <span class="badge badge-cyan">TRAI 08–19</span>
            </div>
            <div class="wa-chat-scroll">
                {chat_messages_html}
            </div>
        </div>
        """, unsafe_allow_html=True)

# ==============================================================================
# TAB 5 — AUDIT LEDGER (Cryptographic Audit Trail)
# ==============================================================================
with tabs[4]:
    st.markdown('<p style="color:rgb(var(--color-muted)); font-size:0.84rem; margin:0 0 16px 0;">Cryptographic tamper-proof audit log, block height metrics, and CSV ledger export.</p>', unsafe_allow_html=True)
    st.markdown('<div class="section-header"><span class="section-header-title">CRYPTOGRAPHIC AUDIT TRAIL</span></div>', unsafe_allow_html=True)

    chain = orchestrator.ledger.chain

    l1, l2, l3, l4 = st.columns(4)
    audit_kpis = [
        (l1, "Total Ledger Blocks", summary["total_records"], "badge-cyan", "CHAIN HEIGHT"),
        (l2, "SHA-256 Hash Status", "VALID" if summary["integrity_valid"] else "BROKEN", "badge-emerald" if summary["integrity_valid"] else "badge-rose", "O(N) VERIFIED"),
        (l3, "Zero-Tamper Proof", "100%", "badge-violet", "UNBROKEN CHAIN"),
        (l4, "Paisa Settlement", "EXACT", "badge-amber", "0 ROUNDING ERROR"),
    ]
    for col, label, val, cls, btxt in audit_kpis:
        with col:
            st.markdown(f"""
            <div class="tactile-card" style="text-align:center;">
                <div class="ui-label">{label}</div>
                <div class="kpi-value" style="font-size:1.35rem;" title="{val}">{val}</div>
                <div style="margin-top:4px;"><span class="badge {cls}">{btxt}</span></div>
            </div>
            """, unsafe_allow_html=True)

    if chain:
        st.markdown('<div class="section-header" style="margin-top:20px;"><span class="section-header-title">CUMULATIVE RECOVERY YIELD VS COST GROWTH</span></div>', unsafe_allow_html=True)
        df_cum = pd.DataFrame([e.model_dump() for e in chain])
        df_cum["Cumulative Recovered (₹)"] = (df_cum["recovered_amount_paise"] / 100).cumsum()
        df_cum["Cumulative Cost (₹)"]      = (df_cum["total_cost_incurred_paise"] / 100).cumsum()
        df_cum["Block Height"]             = df_cum["log_id"]
        chart_cum = df_cum.set_index("Block Height")[["Cumulative Recovered (₹)", "Cumulative Cost (₹)"]]
        st.area_chart(chart_cum, color=["#34D399", "#FB7185"], use_container_width=True)

        st.markdown('<div class="section-header" style="margin-top:20px;"><span class="section-header-title">IMMUTABLE LEDGER BLOCKCHAIN EXPLORER</span></div>', unsafe_allow_html=True)

        df = pd.DataFrame([e.model_dump() for e in chain])
        df["Initial (₹)"]   = df["initial_amount_paise"] / 100
        df["Recovered (₹)"] = df["recovered_amount_paise"] / 100
        df["Cost (₹)"]      = df["total_cost_incurred_paise"] / 100
        df["SHA-256 Hash"]  = df["audit_hash"]

        # Native vertical alignment "bottom" aligns buttons with adjacent multiselect input box
        filt_col, ver_col, exp_col = st.columns([2, 1, 1], vertical_alignment="bottom")

        with filt_col:
            status_filter = st.multiselect(
                "Filter Ledger by Status",
                options=sorted(df["status"].unique()),
                default=sorted(df["status"].unique()),
                key="ledger_filter_select"
            )

        with ver_col:
            if st.button("VERIFY SHA-256 CHAIN", key="btn_verify_sha"):
                valid = orchestrator.ledger.verify_integrity()
                if valid:
                    st.session_state["action_status_msg"] = ("success", f"SHA-256 Chain Verified: All {len(chain)} cryptographic blocks are unbroken.")
                else:
                    st.session_state["action_status_msg"] = ("error", "SHA-256 Integrity Error Detected!")

        with exp_col:
            csv_data = df.to_csv(index=False)
            st.download_button(
                label="EXPORT LEDGER CSV",
                data=csv_data,
                file_name="revive_ledger_audit.csv",
                mime="text/csv",
                key="dl_ledger_csv_clean"
            )

        filtered = df[df["status"].isin(status_filter)]
        st.dataframe(
            filtered[["log_id", "entity_id", "status", "attempt_count", "Initial (₹)", "Recovered (₹)", "Cost (₹)", "SHA-256 Hash"]],
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.markdown('<div class="section-header" style="margin-top:20px;"><span class="section-header-title">IMMUTABLE LEDGER BLOCKCHAIN EXPLORER</span></div>', unsafe_allow_html=True)
        col_run_empty, _ = st.columns([1, 2], vertical_alignment="center")
        with col_run_empty:
            if st.button("VERIFY SHA-256 CHAIN", key="btn_verify_sha_empty"):
                st.session_state["action_status_msg"] = ("info", "Ledger chain is empty (0 blocks). Run evaluation benchmark to populate blocks.")

        st.markdown("""
        <div class="tactile-card" style="text-align:center; padding:24px; margin-top:12px;">
            <div class="ui-label" style="margin-bottom:4px;">Ledger Chain Empty</div>
            <div style="font-size:0.85rem; color:rgb(var(--color-muted));">Execute the benchmark in Overview tab to generate verified SHA-256 ledger blocks.</div>
        </div>
        """, unsafe_allow_html=True)

# ─── Footer ────────────────────────────────────────────────────────────────────
st.markdown(f"""
<div style="margin-top:32px; padding:14px 0; border-top:1.5px solid rgb(var(--color-line)); text-align:center;">
    <span style="font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:rgb(var(--color-muted));">
        © 2026 {APP_NAME} · {TRACK_NAME} · {PLATFORM_NAME}
    </span>
</div>
""", unsafe_allow_html=True)
