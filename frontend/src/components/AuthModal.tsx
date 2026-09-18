"use client";

import { useState } from "react";
import { THEME } from "@/lib/theme";
import type { AuthUser } from "@/hooks/useAuth";

type Mode = "login" | "signup";
type SignupStep = "details" | "otp";

const COUNTRY_CODES = ["+91", "+1", "+44", "+61", "+971"] as const;
const FORM_ID = "auth-form";

function IconUser({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} text-white`}>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.5 20c1.4-4 4.2-6 7.5-6s6.1 2 7.5 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 7l7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <rect x="5" y="10.5" width="14" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 19c1.3-3.6 3.9-5.4 7-5.4s5.7 1.8 7 5.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FieldRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl bg-neu-bg text-neu-sub shadow-neuInset">
      <span className="flex w-11 shrink-0 items-center justify-center">{icon}</span>
      {children}
    </div>
  );
}

const TEXT_INPUT_CLASSES =
  "min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-neu-text outline-none placeholder:text-neu-sub";

/** A country-code select attached to an identifier/mobile input. Doesn't
 * reuse `FieldRow` — that icon slot is a fixed 44px box sized for a small
 * SVG glyph, which crushes a wider "+91 ▾" select into an unreadable,
 * distorted sliver. The select gets its own natural (content-sized) width
 * here instead. */
function CodePrefixedField({
  code,
  onCodeChange,
  ...inputProps
}: {
  code: string;
  onCodeChange: (v: string) => void;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl bg-neu-bg shadow-neuInset">
      <select
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        aria-label="Country code"
        className="shrink-0 bg-neu-bg py-3 pl-3.5 pr-1 text-sm text-neu-text outline-none"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <div className="my-2 w-px shrink-0 bg-neu-surface" />
      <input {...inputProps} className={TEXT_INPUT_CLASSES} />
    </div>
  );
}

export function AuthModal({
  onClose,
  onAuthenticated,
}: {
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<SignupStep>("details");

  // Login
  const [countryCode, setCountryCode] = useState<string>("+91");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Signup
  const [name, setName] = useState("");
  const [mobileCode, setMobileCode] = useState<string>("+91");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");

  const passwordsMismatch =
    confirmPassword.length > 0 && signupPassword !== confirmPassword;

  const canSubmitLogin = identifier.trim().length > 2 && password.length > 0;
  const canContinueSignup =
    name.trim().length > 0 &&
    mobile.trim().length >= 7 &&
    email.trim().includes("@") &&
    signupPassword.length >= 6 &&
    signupPassword === confirmPassword;
  const canVerifyOtp = otp.trim().length >= 4;

  function switchMode(next: Mode) {
    setMode(next);
    setStep("details");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "login") {
      if (!canSubmitLogin) return;
      onAuthenticated({ name: identifier.split("@")[0], identifier: `${countryCode} ${identifier}`.trim() });
      return;
    }
    if (step === "details") {
      if (!canContinueSignup) return;
      setStep("otp");
      return;
    }
    if (!canVerifyOtp) return;
    onAuthenticated({ name: name.trim(), identifier: email.trim() });
  }

  const submitLabel =
    mode === "login" ? "Log in" : step === "details" ? "Continue" : "Verify & create account";
  const canSubmit =
    mode === "login" ? canSubmitLogin : step === "details" ? canContinueSignup : canVerifyOtp;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" />

      <div className="relative w-full max-w-md">
        <div className="absolute left-1/2 top-0 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-2xl ring-4 ring-neu-surface bg-gradient-to-br from-amber-300 to-orange-500">
          <IconUser />
        </div>

        <div className="relative rounded-[32px] bg-neu-surface px-8 pb-20 pt-14 shadow-2xl sm:px-10 sm:pb-24">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-1.5 text-neu-sub transition hover:bg-neu-bg hover:text-neu-text"
          >
            ✕
          </button>

          <h2 className="text-center text-2xl font-bold text-neu-text">
            {mode === "login" ? "Log in" : step === "details" ? "Create your account" : "Verify it's you"}
          </h2>
          <p className="mt-1.5 text-center text-sm text-neu-sub">
            {mode === "login"
              ? "Sign in to keep track of your questions across visits."
              : step === "details"
                ? "A quick verification keeps your account secure."
                : `Enter the code sent to ${email || "your email"} and ${mobileCode} ${mobile || "your mobile"}.`}
          </p>

          {step === "details" && (
            <div className="relative mt-6 flex rounded-full bg-neu-bg p-1 shadow-neuInset">
              <div
                className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full shadow-neuSm transition-all duration-300 ${THEME.amber.fill} ${
                  mode === "signup" ? "translate-x-full" : "translate-x-0"
                }`}
              />
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`relative z-10 flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${
                  mode === "login" ? "text-white" : "text-neu-sub"
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`relative z-10 flex-1 rounded-full py-2 text-xs font-semibold transition-colors ${
                  mode === "signup" ? "text-white" : "text-neu-sub"
                }`}
              >
                Sign up
              </button>
            </div>
          )}

          <form id={FORM_ID} onSubmit={handleSubmit} className="mt-6 space-y-3.5">
            {mode === "login" && (
              <>
                <CodePrefixedField
                  code={countryCode}
                  onCodeChange={setCountryCode}
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email or mobile number"
                  autoComplete="username"
                />
                <FieldRow icon={<IconLock />}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className={TEXT_INPUT_CLASSES}
                    autoComplete="current-password"
                  />
                </FieldRow>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <label className="flex items-center gap-1.5 text-neu-sub">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-3.5 w-3.5 accent-amber-500"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    title="Coming soon"
                    onClick={(e) => e.preventDefault()}
                    className="font-medium text-neu-sub underline decoration-neu-bg underline-offset-2 hover:text-neu-text"
                  >
                    Forgot password?
                  </button>
                </div>
              </>
            )}

            {mode === "signup" && step === "details" && (
              <>
                <FieldRow icon={<IconPerson />}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className={TEXT_INPUT_CLASSES}
                    autoComplete="name"
                  />
                </FieldRow>
                <CodePrefixedField
                  code={mobileCode}
                  onCodeChange={setMobileCode}
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Mobile number"
                  autoComplete="tel"
                />
                <FieldRow icon={<IconMail />}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email ID"
                    className={TEXT_INPUT_CLASSES}
                    autoComplete="email"
                  />
                </FieldRow>
                <FieldRow icon={<IconLock />}>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Password"
                    className={TEXT_INPUT_CLASSES}
                    autoComplete="new-password"
                  />
                </FieldRow>
                <FieldRow icon={<IconLock />}>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className={TEXT_INPUT_CLASSES}
                    autoComplete="new-password"
                  />
                </FieldRow>
                {passwordsMismatch && (
                  <p className="text-xs text-rose-500">Passwords don&apos;t match.</p>
                )}
              </>
            )}

            {mode === "signup" && step === "otp" && (
              <>
                <FieldRow icon={<IconShield />}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter OTP"
                    className={`${TEXT_INPUT_CLASSES} tracking-[0.4em]`}
                    autoComplete="one-time-code"
                  />
                </FieldRow>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setStep("details")}
                    className="font-semibold text-neu-sub hover:text-neu-text"
                  >
                    ← Edit details
                  </button>
                  <button
                    type="button"
                    title="Coming soon"
                    onClick={(e) => e.preventDefault()}
                    className="font-medium text-neu-sub underline decoration-neu-bg underline-offset-2 hover:text-neu-text"
                  >
                    Resend OTP
                  </button>
                </div>
              </>
            )}
          </form>

          <p className="mt-5 text-center text-[10px] leading-relaxed text-neu-sub">
            Prototype UI — accounts aren&apos;t verified against a real backend
            yet, this just remembers your details on this device.
          </p>
        </div>

        <button
          type="submit"
          form={FORM_ID}
          disabled={!canSubmit}
          className={`absolute inset-x-8 -bottom-9 z-20 rounded-2xl py-3.5 text-sm font-semibold shadow-2xl ring-4 ring-neu-surface transition disabled:cursor-not-allowed sm:inset-x-10 ${
            canSubmit ? `text-white ${THEME.amber.fill}` : "bg-neu-bg text-neu-sub"
          }`}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
