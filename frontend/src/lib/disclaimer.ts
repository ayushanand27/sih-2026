/** The problem statement requires the assistant to "clearly state that it
 * provides information and not legal advice." The generation prompt
 * (backend/generation/prompts.py) deliberately keeps the model's own answers
 * free of inline disclaimer text, so this is surfaced structurally in the UI
 * instead — on every answer, in the chat header, and in the site footer. */
export const DISCLAIMER_SHORT = "Information only — not legal advice.";

export const DISCLAIMER_LONG =
  "IP-SAKTI Sahayak explains how the law generally applies — it is not a substitute for advice from a qualified IP attorney or the relevant government office. Verify anything time-sensitive or high-stakes before acting on it.";
