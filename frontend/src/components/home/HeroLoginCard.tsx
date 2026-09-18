"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { THEME } from "@/lib/theme";

type Mode = "login" | "signup";

const COUNTRY_CODES = ["+91", "+1", "+44", "+61", "+971"] as const;

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-white">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 20c1.4-4 4.2-6 7.5-6s6.1 2 7.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

const FIELD_ROW_CLASSES = "flex items-stretch overflow-hidden rounded-2xl border border-clay-200 bg-white text-ink/40";
const ROW_INPUT_CLASSES =
  "min-w-0 flex-1 bg-transparent px-2 py-4 text-base text-ink outline-none placeholder:text-ink/40";

function FieldRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={FIELD_ROW_CLASSES}>
      <span className="flex w-12 shrink-0 items-center justify-center">{icon}</span>
      {children}
    </div>
  );
}

/** An identifier field ("Email or mobile number") with a country-code
 * prefix attached, so a mobile number can be entered without an extra
 * field — mirrors the country-code selector on the app's full `AuthModal`. */
function CodePrefixedField({
  code,
  onCodeChange,
  ...inputProps
}: {
  code: string;
  onCodeChange: (v: string) => void;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={FIELD_ROW_CLASSES}>
      <select
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        aria-label="Country code"
        className="shrink-0 bg-white py-4 pl-4 pr-1 text-base text-ink outline-none"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <div className="my-2.5 w-px shrink-0 bg-clay-200" />
      <input {...inputProps} className={ROW_INPUT_CLASSES} />
    </div>
  );
}

/** The Hero's floating credentials card, styled after the app's full
 * `AuthModal` (avatar badge, amber tab switcher, icon fields) and doubling
 * as a lightweight signup form so the header/footer "Sign Up" CTAs have
 * somewhere to land — both modes write through the same `useAuth`
 * placeholder session used by the rest of the app (there's no real auth
 * backend yet). Login and signup render only their own fields (no hidden
 * placeholder rows — that approach left dead gaps wherever a field from
 * the other mode used to sit); instead the form has a fixed minimum height
 * sized for signup, the taller of the two, so the card's outer frame still
 * doesn't visibly resize when the tab is switched — any leftover space in
 * the shorter login form just collects below the submit button. */
export function HeroLoginCard({
  mode,
  onModeChange,
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}) {
  const { user, login, logout } = useAuth();
  const [countryCode, setCountryCode] = useState<string>("+91");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Signup keeps email and mobile as two separate, both-required fields
  // (rather than the single "email or mobile" identifier login uses).
  const [signupEmail, setSignupEmail] = useState("");
  const [mobileCode, setMobileCode] = useState<string>("+91");
  const [mobile, setMobile] = useState("");

  const canSubmit =
    mode === "login"
      ? identifier.trim().length > 2 && password.length > 0
      : name.trim().length > 0 &&
        signupEmail.trim().includes("@") &&
        mobile.trim().length >= 7 &&
        password.length >= 6 &&
        password === confirmPassword;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (mode === "signup") {
      login({ name: name.trim(), identifier: signupEmail.trim() });
      return;
    }
    login({ name: identifier.split("@")[0], identifier: `${countryCode} ${identifier.trim()}` });
  }

  if (user) {
    return (
      <div className="relative w-full max-w-2xl">
        <div className="absolute left-1/2 top-0 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-2xl ring-4 ring-paper bg-gradient-to-br from-amber-300 to-orange-500">
          <IconUser />
        </div>
        <div
          id="top-login-section"
          className="scroll-mt-24 rounded-[32px] bg-paper p-10 pt-16 text-center shadow-2xl sm:p-14 sm:pt-20"
        >
          <p className="text-lg font-semibold text-forest-700">Welcome back</p>
          <h3 className="mt-2 text-3xl font-bold text-ink">{user.name}</h3>
          <p className="mt-2 truncate text-base text-ink/60">{user.identifier}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-8 w-full rounded-2xl border border-clay-200 py-4 text-lg font-semibold text-ink/70 transition hover:bg-clay-50"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-2xl">
      <div className="absolute left-1/2 top-0 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-2xl ring-4 ring-paper bg-gradient-to-br from-amber-300 to-orange-500">
        <IconUser />
      </div>

      <div
        id="top-login-section"
        className="scroll-mt-24 rounded-[32px] bg-paper p-10 pt-16 shadow-2xl sm:p-14 sm:pt-20"
      >
        <h2 className="text-center text-2xl font-bold text-ink sm:text-3xl">
          {mode === "login" ? "Log in" : "Create your account"}
        </h2>
        <p className="mt-2 text-center text-sm text-ink/60 sm:text-base">
          {mode === "login"
            ? "Sign in to keep track of your questions across visits."
            : "A few details, and you're set."}
        </p>

        <div className="relative mt-6 flex rounded-full bg-clay-50 p-1.5">
          <div
            className={`absolute inset-y-1.5 left-1.5 w-[calc(50%-6px)] rounded-full shadow-sm transition-transform duration-300 ${THEME.amber.fill} ${
              mode === "signup" ? "translate-x-full" : "translate-x-0"
            }`}
          />
          <button
            type="button"
            onClick={() => onModeChange("login")}
            className={`relative z-10 flex-1 rounded-full py-3.5 text-base font-semibold transition-colors ${
              mode === "login" ? "text-white" : "text-ink/60"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => onModeChange("signup")}
            className={`relative z-10 flex-1 rounded-full py-3.5 text-base font-semibold transition-colors ${
              mode === "signup" ? "text-white" : "text-ink/60"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex min-h-[420px] flex-col gap-4">
          {mode === "signup" && (
            <FieldRow icon={<IconPerson />}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                autoComplete="name"
                className={ROW_INPUT_CLASSES}
              />
            </FieldRow>
          )}

          {mode === "login" ? (
            <CodePrefixedField
              code={countryCode}
              onCodeChange={setCountryCode}
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or mobile number"
              autoComplete="username"
            />
          ) : (
            <>
              <FieldRow icon={<IconMail />}>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  className={ROW_INPUT_CLASSES}
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
            </>
          )}

          <FieldRow icon={<IconLock />}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={ROW_INPUT_CLASSES}
            />
          </FieldRow>

          {mode === "signup" && (
            <FieldRow icon={<IconLock />}>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                className={ROW_INPUT_CLASSES}
              />
            </FieldRow>
          )}

          {mode === "login" && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink/60">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                Remember me
              </label>
              <button
                type="button"
                title="Coming soon"
                onClick={(e) => e.preventDefault()}
                className="font-medium text-ink/60 underline decoration-clay-200 underline-offset-2 hover:text-ink"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-auto w-full rounded-2xl bg-saffron-500 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-saffron-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm leading-relaxed text-ink/50">
          Prototype UI — this remembers your details on this device only.
        </p>
      </div>
    </div>
  );
}
