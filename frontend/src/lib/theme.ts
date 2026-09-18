export type ThemeName = "rose" | "sage" | "amber";

export const THEME: Record<
  ThemeName,
  { badge: string; fill: string; dot: string; text: string }
> = {
  rose: {
    badge: "bg-gradient-to-br from-rose-300 to-orange-400",
    fill: "bg-gradient-to-r from-rose-300 to-orange-400",
    dot: "bg-rose-400",
    text: "text-rose-600",
  },
  sage: {
    badge: "bg-gradient-to-br from-[#B7C79E] to-[#748C5B]",
    fill: "bg-gradient-to-r from-[#B7C79E] to-[#748C5B]",
    dot: "bg-[#748C5B]",
    text: "text-[#5B6F45]",
  },
  amber: {
    badge: "bg-gradient-to-br from-amber-300 to-orange-500",
    fill: "bg-gradient-to-r from-amber-300 to-orange-500",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
};

/** The dark botanical backdrop every page sits on. */
export const PAGE_BG =
  "bg-gradient-to-br from-[#0D2B22] via-[#1F4536] to-[#6E4A2A]";
