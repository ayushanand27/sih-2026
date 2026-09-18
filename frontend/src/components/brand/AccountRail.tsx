"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthModal } from "@/components/AuthModal";

/** `shadow-neu`'s light-highlight layer is tuned for a light backdrop; on
 * this component's dark botanical background it reads as a bright glow, so
 * this dims that highlight instead of using the shared utility. */
const RAIL_SHADOW = "shadow-[9px_9px_18px_rgba(0,0,0,0.25),-6px_-6px_14px_rgba(255,250,240,0.35)]";

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-neu-text">
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

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.7 6.3l-1.55 1.55M7.85 16.15 6.3 17.7M17.7 17.7l-1.55-1.55M7.85 7.85 6.3 6.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 16l4-4-4-4M20 12H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Left-edge account entry point on the intake screen — a tab flush against
 * the viewport's left border (square on that side, rounded only on the
 * right), matching the neu-morphic card. Signed out, it shows the full
 * "Login / Sign up" label by default and collapses to just the icon once
 * clicked (while the modal is up); signed in, it shows only the avatar
 * icon and expands on hover into a small account card (name, identifier,
 * settings/logout). UI shell only — there's no backend auth yet, so
 * "logging in" just remembers a name/identifier locally (see useAuth)
 * until a real backend exists. Hidden below `lg`, where the intake card
 * leaves no side margin to spare. */
export function AccountRail({ onBack }: { onBack?: () => void } = {}) {
  const { user, login, logout } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const guestExpanded = !user && !modalOpen;

  return (
    <>
      <div className="fixed left-0 top-6 z-20 hidden flex-col items-start gap-3 lg:flex">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className={`flex h-14 items-center gap-2 rounded-r-full bg-neu-surface px-5 text-xs font-semibold text-neu-text transition hover:bg-neu-bg ${RAIL_SHADOW}`}
          >
            <span aria-hidden>←</span> Back
          </button>
        )}
        {user ? (
          <div className={`group flex h-14 w-14 flex-col overflow-hidden rounded-r-full bg-neu-surface ${RAIL_SHADOW} transition-all duration-300 ease-out hover:h-44 hover:w-64 hover:rounded-r-[28px]`}>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center">
              <IconUser />
            </span>
            <div className="flex min-w-0 flex-col gap-2.5 px-4 pb-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-neu-text">{user.name}</p>
                <p className="truncate text-xs text-neu-sub/80">{user.identifier}</p>
              </div>
              <div className="flex items-center gap-2 border-t border-neu-bg pt-2.5">
                <button
                  type="button"
                  title="Account settings"
                  onClick={(e) => e.preventDefault()}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neu-sub transition hover:bg-neu-bg hover:text-neu-text"
                >
                  <IconGear />
                </button>
                <button
                  type="button"
                  title="Log out"
                  onClick={logout}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neu-sub transition hover:bg-rose-100 hover:text-rose-600"
                >
                  <IconLogout />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={`flex h-14 items-center overflow-hidden rounded-r-full bg-neu-surface ${RAIL_SHADOW} transition-[width] duration-300 ease-out ${
              guestExpanded ? "w-44" : "w-14"
            }`}
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center">
              <IconUser />
            </span>
            <span
              className={`whitespace-nowrap pr-4 text-xs font-semibold text-neu-text transition-opacity duration-200 ${
                guestExpanded ? "opacity-100" : "opacity-0"
              }`}
            >
              Login / Sign up
            </span>
          </button>
        )}
      </div>

      {modalOpen && (
        <AuthModal
          onClose={() => setModalOpen(false)}
          onAuthenticated={(next) => {
            login(next);
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}
