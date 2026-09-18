/** Mirrors `backend/api/tts.py::BULBUL_SUPPORTED_LANGUAGES` (11 codes; ur-IN not included). */
export const BULBUL_SUPPORTED_BCP47: readonly string[] = [
  "en-IN",
  "hi-IN",
  "bn-IN",
  "gu-IN",
  "kn-IN",
  "ml-IN",
  "mr-IN",
  "od-IN",
  "pa-IN",
  "ta-IN",
  "te-IN",
];

const BULBUL_SET = new Set(BULBUL_SUPPORTED_BCP47);

export function bulbulSupports(languageBcp47: string): boolean {
  return BULBUL_SET.has(languageBcp47);
}
