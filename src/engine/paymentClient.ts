export class PaymentClientWrapper {
  public createPaymentLink(
    entity_id: string,
    amount_paise: number,
    description: string,
    customer_phone?: string,
    expire_hours: number = 48
  ) {
    const cleanId = entity_id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    return {
      id: `plink_${cleanId}`,
      short_url: `https://rzp.io/i/rec_${cleanId}`,
      status: "created",
      amount: amount_paise,
      description: description,
      is_mock: true,
      is_degraded_fallback: true,
    };
  }

  public generateVirtualAccount(invoice_id: string, amount_paise?: number) {
    const cleanId = invoice_id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    return {
      virtual_account_id: `va_${cleanId}`,
      upi_id: `rzp.virtual.${cleanId}@hdfcbank`,
      account_number: `7890${cleanId}`,
      ifsc: "RATN0VAAPIS",
      bank_name: "RBL Bank (Razorpay VA)",
      amount_expected: amount_paise,
      is_mock: true,
      is_degraded_fallback: true,
    };
  }

  public retrySubscription(subscription_id: string) {
    return {
      subscription_id,
      status: "retry_scheduled",
      message: "Silent subscription retry dispatched via API",
      is_mock: true,
    };
  }
}
