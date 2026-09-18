"use client";

import { useCallback, useEffect, useState } from "react";

export const LANGUAGES = [
  { code: "en", label: "English", bcp47: "en-IN" },
  { code: "hi", label: "हिन्दी", bcp47: "hi-IN" },
  { code: "bn", label: "বাংলা", bcp47: "bn-IN" },
  { code: "gu", label: "ગુજરાતી", bcp47: "gu-IN" },
  { code: "mr", label: "मराठी", bcp47: "mr-IN" },
  { code: "ta", label: "தமிழ்", bcp47: "ta-IN" },
  { code: "te", label: "తెలుగు", bcp47: "te-IN" },
  { code: "kn", label: "ಕನ್ನಡ", bcp47: "kn-IN" },
  { code: "ml", label: "മലയാളം", bcp47: "ml-IN" },
  { code: "pa", label: "ਪੰਜਾਬੀ", bcp47: "pa-IN" },
  { code: "or", label: "ଓଡ଼ିଆ", bcp47: "od-IN" },
  { code: "ur", label: "اردو", bcp47: "ur-IN" },
  // Verified via live Bhashini probe (2026-09-18); Sarvam mayura returns 400 for these codes.
  { code: "as", label: "অসমীয়া", bcp47: "as-IN", bhashiniOnly: true },
  { code: "brx", label: "बड़ो", bcp47: "brx-IN", bhashiniOnly: true },
  { code: "doi", label: "डोगरी", bcp47: "doi-IN", bhashiniOnly: true },
  { code: "ks", label: "کٲشُر", bcp47: "ks-IN", bhashiniOnly: true },
  { code: "mai", label: "मैथिली", bcp47: "mai-IN", bhashiniOnly: true },
  { code: "mni", label: "মৈতৈলোন্", bcp47: "mni-IN", bhashiniOnly: true },
  { code: "ne", label: "नेपाली", bcp47: "ne-IN", bhashiniOnly: true },
  { code: "sa", label: "संस्कृतम्", bcp47: "sa-IN", bhashiniOnly: true },
  { code: "sat", label: "ᱥᱟᱱᱛᱟᱲᱤ", bcp47: "sat-IN", bhashiniOnly: true },
  { code: "sd", label: "سنڌي", bcp47: "sd-IN", bhashiniOnly: true },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const STORAGE_KEY = "ipsakti:language";
const DEFAULT_CODE: LanguageCode = "en";

function readStoredCode(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_CODE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return LANGUAGES.find((l) => l.code === raw)?.code ?? DEFAULT_CODE;
}

/** Site-wide selected language, persisted across visits/pages. Sent to the
 * backend as QueryRequest.language so Bhashini (Sarvam fallback) can
 * translate the question and answer; also used as the BCP-47 locale for
 * browser voice I/O. */
export function useLanguage() {
  const [code, setCode] = useState<LanguageCode>(DEFAULT_CODE);

  useEffect(() => {
    setCode(readStoredCode());
  }, []);

  const setLanguage = useCallback((next: LanguageCode) => {
    setCode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode, etc.) — selection still applies for this session.
    }
  }, []);

  const language = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

  return { language, setLanguage };
}
