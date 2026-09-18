"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  ApiNotConfiguredError,
  ClientTimeoutError,
  query,
  queryStream,
} from "@/lib/api";
import type {
  ChatTurn,
  Citation,
  ConversationMessage,
  Jurisdiction,
  StreamDoneData,
} from "@/lib/types";
import { PAGE_BG } from "@/lib/theme";
import { LeafField } from "@/components/brand/LeafField";
import { useLanguage } from "@/hooks/useLanguage";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { bulbulSupports } from "@/lib/bulbulLanguages";
import { playWavBase64 } from "@/lib/playWavBase64";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  generateSessionId,
  useChatHistory,
  type ChatSession,
} from "@/hooks/useChatHistory";
import { Header } from "./Header";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { LoadingState } from "./LoadingState";
import { SourceViewer } from "./SourceViewer";
import { MobileSourceSheet } from "./MobileSourceSheet";

let idCounter = 0;
const nextId = () => `msg-${++idCounter}-${Date.now()}`;

const TITLE_MAX_LENGTH = 48;
function titleFromMessages(messages: ConversationMessage[]): string {
  const firstQuestion = messages.find((m) => m.role === "user")?.content ?? "";
  if (!firstQuestion) return "New chat";
  return firstQuestion.length > TITLE_MAX_LENGTH
    ? `${firstQuestion.slice(0, TITLE_MAX_LENGTH)}…`
    : firstQuestion;
}

export function ChatView({
  jurisdiction,
  category,
  sessionId: initialSessionId,
  onChangeContext,
}: {
  jurisdiction: Jurisdiction;
  category: string | null;
  sessionId: string | null;
  onChangeContext: () => void;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [voiceModeOn, setVoiceModeOn] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage } = useLanguage();
  const tts = useSpeechSynthesis();
  const recognition = useSpeechRecognition();

  const { sessions, loaded: historyLoaded, saveSession, deleteSession } = useChatHistory();
  const sessionIdRef = useRef(initialSessionId ?? generateSessionId());
  // True once this conversation's starting state is settled — immediately
  // for a brand-new chat, or after a requested saved session has been
  // loaded from history — so the autosave effect below never fires with a
  // still-empty `messages` and clobbers a saved conversation before it has
  // had a chance to load.
  const [ready, setReady] = useState(!initialSessionId);

  useEffect(() => {
    if (ready || !historyLoaded) return;
    const found = sessions.find((s) => s.id === initialSessionId);
    if (found) setMessages(found.messages);
    setReady(true);
    // Only meant to run once, when history finishes its first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded]);

  useEffect(() => {
    if (!ready || messages.length === 0) return;
    saveSession({
      id: sessionIdRef.current,
      jurisdiction,
      category,
      title: titleFromMessages(messages),
      messages,
      updatedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, messages, jurisdiction, category]);

  function handleNewChat() {
    sessionIdRef.current = generateSessionId();
    setMessages([]);
    setInput("");
    setActiveCitation(null);
    setSpeakingId(null);
    tts.stop();
    if (recognition.listening) recognition.stop();
    setVoiceMode(false);
    const params = new URLSearchParams({ jurisdiction });
    if (category) params.set("category", category);
    router.replace(`/chat?${params.toString()}`);
  }

  function handleSelectSession(session: ChatSession) {
    if (session.jurisdiction !== jurisdiction || session.category !== category) {
      const params = new URLSearchParams({ jurisdiction: session.jurisdiction, session: session.id });
      if (session.category) params.set("category", session.category);
      router.push(`/chat?${params.toString()}`);
      return;
    }
    sessionIdRef.current = session.id;
    setMessages(session.messages);
    setInput("");
    setActiveCitation(null);
  }

  // Mirrors `voiceModeOn` so the tts.speak() completion callback (fired long
  // after this render) always sees the latest value instead of a stale one
  // captured in its closure at send-time.
  const voiceModeRef = useRef(false);
  const setVoiceMode = (on: boolean) => {
    voiceModeRef.current = on;
    setVoiceModeOn(on);
  };
  // True while the text currently in the box came from dictation rather than
  // typing — sending it is what turns on the speak-then-relisten loop.
  const inputFromVoiceRef = useRef(false);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  function startListening() {
    setInput("");
    inputFromVoiceRef.current = false;
    recognition.start(language.bcp47, (transcript) => {
      inputFromVoiceRef.current = true;
      setInput(transcript);
    });
  }

  async function handleSend() {
    const question = input.trim();
    if (!question || sending) return;

    const voiceOriginated = inputFromVoiceRef.current;
    inputFromVoiceRef.current = false;

    const history: ChatTurn[] = messages
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: question },
    ]);
    setInput("");
    setSending(true);
    scrollToBottom();

    const assistantId = nextId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", pending: true },
    ]);

    const augmentedQuestion = category
      ? `${question} (regarding a ${category.toLowerCase()} formulation)`
      : question;

    function applyDoneData(data: StreamDoneData, audioBase64?: string | null) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: data.answer,
                citations: data.citations,
                flags: data.flags,
                formulation_category: data.formulation_category,
                formulation_notes: data.formulation_notes,
                confidence_score: data.confidence_score,
                related_provisions: data.related_provisions,
                needs_clarification: data.needs_clarification,
                clarifying_questions: data.clarifying_questions,
                actionable_forms: data.actionable_forms,
                compliance_flags: data.compliance_flags,
                translation_degraded: data.translation_degraded ?? false,
                audio_base64: audioBase64 ?? null,
                pending: false,
              }
            : m
        )
      );
    }

    function speakAnswer(text: string, audioBase64?: string | null) {
      if (audioBase64) {
        setSpeakingId(assistantId);
        playWavBase64(audioBase64, () => {
          setSpeakingId(null);
          if (voiceModeRef.current) startListening();
        });
        return;
      }
      setSpeakingId(assistantId);
      tts.speak(text, language.bcp47, () => {
        setSpeakingId(null);
        if (voiceModeRef.current) startListening();
      });
    }

    try {
      let spokenAnswer = "";
      let responseAudio: string | null = null;
      const wantBulbulTts =
        (voiceModeRef.current || voiceOriginated) && bulbulSupports(language.bcp47);
      const request = {
        question: augmentedQuestion,
        history,
        jurisdiction,
        language: language.bcp47,
        synthesize_audio: wantBulbulTts,
      };
      // English normally streams for UX; Bulbul TTS requires blocking /query
      // (no audio on /query/stream). Non-English always uses /query for translation.
      const useStream = language.bcp47 === "en-IN" && !wantBulbulTts;
      if (useStream) {
        await queryStream(request, {
          onToken: (text) => {
            spokenAnswer += text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + text } : m
              )
            );
            scrollToBottom();
          },
          onDone: (data) => {
            spokenAnswer = data.answer;
            applyDoneData(data);
          },
        });
      } else {
        const data = await query(request);
        spokenAnswer = data.answer;
        responseAudio = data.audio_base64;
        applyDoneData(data, data.audio_base64);
      }

      if (voiceOriginated) setVoiceMode(true);

      if (voiceModeRef.current) {
        speakAnswer(spokenAnswer, responseAudio);
      }
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof ClientTimeoutError || err instanceof ApiNotConfiguredError
          ? err.message
          : "Something went wrong talking to the backend.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "", error: message, pending: false }
            : m
        )
      );
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  const lastQuestion =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? null;
  const hasMessages = messages.length > 0;

  /** Tapping the speaker while it's doing anything (reading an answer, or
   * armed to read/relisten) stops the whole voice loop, per spec. Tapping it
   * while off just enables read-aloud for future answers (no relisten). */
  function toggleVoiceMode() {
    if (voiceModeOn) {
      setVoiceMode(false);
      tts.stop();
      setSpeakingId(null);
      if (recognition.listening) recognition.stop();
    } else {
      setVoiceMode(true);
    }
  }

  /** Tapping the mic while it's listening cancels that listen AND the whole
   * voice loop, per spec — otherwise it starts a fresh one-off dictation. */
  function toggleMic() {
    if (recognition.listening) {
      recognition.stop();
      setVoiceMode(false);
      tts.stop();
      setSpeakingId(null);
      return;
    }
    startListening();
  }

  function handleToggleSpeak(message: ConversationMessage) {
    if (speakingId === message.id) {
      tts.stop();
      setSpeakingId(null);
      return;
    }
    if (message.audio_base64) {
      setSpeakingId(message.id);
      playWavBase64(message.audio_base64, () => setSpeakingId(null));
      return;
    }
    setSpeakingId(message.id);
    tts.speak(message.content, language.bcp47, () => setSpeakingId(null));
  }

  return (
    <div className={`relative flex h-screen flex-col overflow-hidden p-0 sm:p-6 ${PAGE_BG}`}>
      <LeafField />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-neu-bg shadow-2xl sm:rounded-[32px]">
        <Header
          jurisdiction={jurisdiction}
          category={category}
          lastQuestion={lastQuestion}
          onChangeContext={onChangeContext}
          language={language}
          onLanguageChange={setLanguage}
          onNewChat={handleNewChat}
          chatSessions={sessions}
          currentSessionId={sessionIdRef.current}
          onSelectSession={handleSelectSession}
          onDeleteSession={deleteSession}
        />

        <div className="flex min-h-0 flex-1 gap-3 p-3 sm:gap-4 sm:p-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-neu-surface shadow-neu">
            {/* Doubles as the top spacer (empty, flex-1) before the first
                message and the scrollable message list (still flex-1) after
                — its height never changes, so nothing needs to animate here. */}
            <div
              ref={scrollRef}
              className={`min-h-0 flex-1 overflow-y-auto px-4 sm:px-8 ${hasMessages ? "py-6" : ""}`}
            >
              {hasMessages && (
                <div className="mx-auto flex w-full max-w-2xl flex-col space-y-4">
                  {messages.map((m) => (
                    <ChatMessageBubble
                      key={m.id}
                      message={m}
                      onViewCitation={setActiveCitation}
                      speaking={speakingId === m.id}
                      onToggleSpeak={() => handleToggleSpeak(m)}
                      speechSupported={tts.supported}
                    />
                  ))}
                  {sending && !messages.some((m) => m.pending) && <LoadingState />}
                </div>
              )}
            </div>

            <div
              className={`flex shrink-0 flex-col items-center px-4 sm:px-8 ${
                hasMessages ? "border-t border-neu-bg py-3" : "pb-6"
              }`}
            >
              <div
                className={`w-full max-w-2xl overflow-hidden text-center transition-all duration-500 ease-out ${
                  hasMessages ? "max-h-0 opacity-0" : "mb-6 max-h-40 opacity-100"
                }`}
              >
                <p className="text-lg font-semibold text-neu-text">
                  Ask about IP, ABS, or regulatory posture for an Ayurvedic
                  formulation
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-neu-sub">
                  The answer will cite exactly which document and page it came
                  from, or say plainly that it couldn&apos;t find one.
                </p>
              </div>

              <div className="w-full max-w-2xl">
                <ChatComposer
                  input={input}
                  onInputChange={(v) => {
                    inputFromVoiceRef.current = false;
                    setInput(v);
                  }}
                  onSend={handleSend}
                  sending={sending}
                  voiceModeOn={voiceModeOn}
                  onToggleVoiceMode={toggleVoiceMode}
                  ttsSupported={tts.supported}
                  speaking={tts.speaking}
                  listening={recognition.listening}
                  onToggleMic={toggleMic}
                  micSupported={recognition.supported}
                />
              </div>

              <p className="mt-2 max-w-2xl text-center text-[11px] text-neu-sub">
                Answers can take up to ~60s — grounded, cited responses are
                slower than a guess.
              </p>
            </div>

            {/* Balances the top spacer to keep the composer centered before
                the first message; smoothly collapses to 0 once one exists,
                sliding the composer down to sit flush at the bottom. */}
            <div
              className={`transition-[flex-grow] duration-500 ease-in-out ${
                hasMessages ? "flex-grow-0" : "flex-1"
              }`}
            />
          </div>

          <aside className="hidden w-[360px] shrink-0 overflow-hidden rounded-3xl bg-neu-surface shadow-neu lg:block xl:w-[420px]">
            <SourceViewer
              citation={activeCitation}
              onClose={() => setActiveCitation(null)}
            />
          </aside>
        </div>
      </div>

      <MobileSourceSheet
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}
