import clsx from "clsx";
import { Mail, Phone } from "lucide-react";
import {
  CHURCH_EMAIL,
  CHURCH_MAILTO,
  CHURCH_PHONE_DISPLAY,
  CHURCH_TEL,
} from "../lib/contact";

const tones = {
  light:
    "inline-flex items-center gap-2 text-sm font-medium text-ink-700 transition hover:text-brand-800",
  dark: "inline-flex items-center gap-2 text-sm text-brand-300 transition hover:text-white",
  onColor: "inline-flex items-center gap-2 text-sm text-white/95 transition hover:text-white",
} as const;

export function ChurchContactLinks({
  tone = "light",
  align = "start",
  className,
}: {
  tone?: keyof typeof tones;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <ul
      className={clsx(
        "space-y-2",
        align === "center" && "flex flex-col items-center",
        className,
      )}
    >
      <li>
        <a href={CHURCH_TEL} className={tones[tone]}>
          <Phone className="h-4 w-4 shrink-0" aria-hidden />
          <span>{CHURCH_PHONE_DISPLAY}</span>
        </a>
      </li>
      <li>
        <a href={CHURCH_MAILTO} className={tones[tone]}>
          <Mail className="h-4 w-4 shrink-0" aria-hidden />
          <span>{CHURCH_EMAIL}</span>
        </a>
      </li>
    </ul>
  );
}

