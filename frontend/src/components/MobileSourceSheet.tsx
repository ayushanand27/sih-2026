"use client";

import { useEffect, useRef, useState } from "react";
import type { Citation } from "@/lib/types";
import { SourceViewer } from "./SourceViewer";

const DISMISS_THRESHOLD_PX = 120;

/** Below `lg`, the source PDF opens as a draggable bottom sheet instead of
 * the permanent side panel — closing it (drag down, backdrop tap, or the
 * viewer's own close button) just removes the overlay, which reveals the
 * chat exactly where it was scrolled (the message and its source list),
 * since the underlying page is never touched while the sheet is open. */
export function MobileSourceSheet({
  citation,
  onClose,
}: {
  citation: Citation | null;
  onClose: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);

  useEffect(() => {
    setDragY(0);
  }, [citation]);

  if (!citation) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    startYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setDragY(Math.max(0, e.clientY - startYRef.current));
  };

  const endDrag = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragY > DISMISS_THRESHOLD_PX) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div className="fixed inset-0 z-20 lg:hidden">
      <button
        type="button"
        aria-label="Close source viewer"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        className={`absolute inset-x-0 bottom-0 flex h-[88vh] flex-col overflow-hidden rounded-t-3xl bg-neu-surface shadow-2xl ${
          draggingRef.current ? "" : "transition-transform duration-200 ease-out"
        }`}
        style={{ transform: `translateY(${dragY}px)` }}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="flex shrink-0 touch-none justify-center pb-1 pt-2.5"
        >
          <span className="h-1.5 w-10 rounded-full bg-neu-bg" />
        </div>
        <div className="min-h-0 flex-1">
          <SourceViewer citation={citation} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
