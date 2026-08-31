import { Link } from "react-router-dom";
import clsx from "clsx";
import type { ReactNode } from "react";

const SIZES = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-14 w-14",
} as const;

export function BrandLogo({
  size = "md",
  to = "/",
  className,
  onNavigate,
  children,
}: {
  size?: keyof typeof SIZES;
  to?: string;
  className?: string;
  onNavigate?: () => void;
  children?: ReactNode;
}) {
  return (
    <Link
      to={to}
      title={to === "/app" ? "Go to ministry portal" : "Go to homepage"}
      aria-label={to === "/app" ? "Go to ministry portal" : "Go to homepage"}
      onClick={onNavigate}
      className={clsx("group flex min-w-0 items-center gap-3", className)}
    >
      <span
        className={clsx(
          SIZES[size],
          "relative inline-flex shrink-0 items-center justify-center rounded-full",
          "bg-gradient-to-br from-gold-300 via-gold-600 to-brand-900 p-[2px]",
          "shadow-[0_4px_16px_rgba(46,16,101,0.45)] ring-1 ring-gold-300/50",
        )}
      >
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_32%_28%,#7c3aed_0%,#4c1d95_52%,#2e1065_100%)]">
          <img
            src="/brand/igc-logo.png"
            alt=""
            className="h-[94%] w-[94%] object-contain"
          />
        </span>
      </span>
      {children}
    </Link>
  );
}
