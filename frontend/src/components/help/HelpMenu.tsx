"use client";

import { useState } from "react";
import type { Jurisdiction } from "@/lib/types";
import { SidePanel } from "@/components/SidePanel";
import { OfficialResourcesPanel } from "./OfficialResourcesPanel";
import { AbsTkdlHelperPanel } from "./AbsTkdlHelperPanel";
import { FacilitatorPanel } from "./FacilitatorPanel";

type PanelKey = "resources" | "abs" | "facilitator";

const MENU_ITEMS: { key: PanelKey; label: string; description: string }[] = [
  {
    key: "resources",
    label: "Official resources & registries",
    description: "TKDL, IP India, NBA, India Code",
  },
  {
    key: "abs",
    label: "ABS & prior-art helper",
    description: "Compliance checklist and TKDL guidance",
  },
  {
    key: "facilitator",
    label: "Talk to a human facilitator",
    description: "Escalate your specific case",
  },
];

function IconHelp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-neu-text">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.29c-.7.32-1 .82-1 1.46v.35"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.7" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** Groups the three problem-statement features that don't belong to a
 * single existing surface — official-registry pointers, an ABS/TKDL
 * helper, and human-facilitator escalation — behind one header button
 * instead of three more icons crowding the bar. Picking a menu item opens
 * the matching content in the same shared `SidePanel`. */
export function HelpMenu({
  jurisdiction,
  category,
  lastQuestion,
}: {
  jurisdiction: Jurisdiction;
  category: string | null;
  lastQuestion: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-neu-text shadow-neuSm transition hover:bg-neu-bg"
      >
        <IconHelp />
        Help
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close help menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl bg-neu-surface p-1.5 shadow-neu">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActivePanel(item.key);
                  setMenuOpen(false);
                }}
                className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition-colors hover:bg-neu-bg/60"
              >
                <span className="text-xs font-semibold text-neu-text">{item.label}</span>
                <span className="text-[10px] text-neu-sub">{item.description}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <SidePanel
        open={activePanel !== null}
        onClose={() => setActivePanel(null)}
        widthClassName="w-96 max-w-[90vw]"
      >
        {activePanel === "resources" && <OfficialResourcesPanel />}
        {activePanel === "abs" && (
          <AbsTkdlHelperPanel category={category} onTalkToFacilitator={() => setActivePanel("facilitator")} />
        )}
        {activePanel === "facilitator" && (
          <FacilitatorPanel jurisdiction={jurisdiction} category={category} lastQuestion={lastQuestion} />
        )}
      </SidePanel>
    </div>
  );
}
