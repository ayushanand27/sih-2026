"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Renders `children` as a full-height panel pinned to the right edge of the
 * viewport, above everything else on the page — via a portal to
 * `document.body`, so it isn't clipped by an ancestor's `overflow-hidden`
 * (the header bar this is used from needs `overflow-hidden` for its own
 * rounded corners, which previously cut these popovers off mid-way). */
export function SidePanel({
  open,
  onClose,
  children,
  widthClassName = "w-80 max-w-[85vw]",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-black/10"
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 overflow-y-auto bg-neu-surface p-4 pt-12 text-left shadow-2xl ${widthClassName}`}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-neu-sub transition hover:bg-neu-bg hover:text-neu-text"
        >
          ✕
        </button>
        {children}
      </div>
    </>,
    document.body
  );
}
