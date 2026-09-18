import Image from "next/image";

/** Rendered at a handful of fixed icon sizes across the app (36-56px) via
 * `className` on the wrapper — never full-width/responsive — so a single
 * `sizes` hint covering the largest of them is accurate for all of them.
 * `fill` needs a positioned, explicitly-sized ancestor, which is what the
 * wrapping span (carrying the size classes previously passed straight to
 * the image) provides. */
export function LogoBadge({
  className = "h-14 w-14",
  sizes = "56px",
}: {
  className?: string;
  sizes?: string;
}) {
  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <Image src="/logo.png" alt="IP-SAKTI Sahayak" fill sizes={sizes} className="object-contain" />
    </span>
  );
}
