"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { HomeHeader } from "./HomeHeader";
import { HomeHero } from "./HomeHero";
import { FaqSection } from "./FaqSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { CtaFooterSection } from "./CtaFooterSection";

type Mode = "login" | "signup";

function scrollToLoginCard() {
  document.getElementById("top-login-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function HomePage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<Mode>("login");

  const openLogin = useCallback((mode: Mode) => {
    setLoginMode(mode);
    scrollToLoginCard();
  }, []);

  return (
    <main className="min-h-screen bg-paper text-ink">
      <HomeHeader />

      <HomeHero
        loginMode={loginMode}
        onLoginModeChange={setLoginMode}
        onSkipToNextPage={() => router.push("/intake")}
      />

      <FaqSection />

      <TestimonialsSection />

      <CtaFooterSection
        onLoginClick={() => openLogin("login")}
        onSignUpClick={() => openLogin("signup")}
        onSkipToChat={() => router.push("/intake")}
      />
    </main>
  );
}
