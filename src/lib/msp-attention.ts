/** Days without a saved cloud assessment before we flag the customer as stale (documented for MSP attention). */
export const MSP_STALE_ASSESSMENT_DAYS = 14;

export const MSP_ATTENTION_DOC = `Stale = no saved assessment in the last ${MSP_STALE_ASSESSMENT_DAYS} days (per customer).`;
