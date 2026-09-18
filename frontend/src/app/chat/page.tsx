"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatView } from "@/components/ChatView";
import type { Jurisdiction } from "@/lib/types";

function isJurisdiction(value: string | null): value is Jurisdiction {
  return value === "india" || value === "international";
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jurisdictionParam = searchParams.get("jurisdiction");
  const category = searchParams.get("category") || null;
  const sessionParam = searchParams.get("session");

  useEffect(() => {
    if (!isJurisdiction(jurisdictionParam)) {
      router.replace("/intake");
    }
  }, [jurisdictionParam, router]);

  if (!isJurisdiction(jurisdictionParam)) {
    return null;
  }

  return (
    <ChatView
      // Remounts (dropping all in-memory state) whenever the jurisdiction,
      // category, or a specific saved session id changes via the URL — the
      // one path ("New chat"/resuming a same-jurisdiction session) that
      // updates state directly without navigating skips this deliberately.
      key={`${jurisdictionParam}-${category ?? ""}-${sessionParam ?? ""}`}
      jurisdiction={jurisdictionParam}
      category={category}
      sessionId={sessionParam}
      onChangeContext={() => router.push("/intake")}
    />
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageContent />
    </Suspense>
  );
}
