import { CHURCH_TIME_ZONE } from "./format";

export interface ChurchProgram {
  id: string;
  title: string;
  description: string | null;
  type: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  image_url: string | null;
}

export const PROGRAM_TYPE_LABELS: Record<string, string> = {
  revival: "Revival",
  program: "Program",
  service: "Service",
  prayer: "Prayer",
  outreach: "Outreach",
};

export function programTypeLabel(type?: string | null): string {
  if (!type) return "Program";
  return PROGRAM_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

export function programTimeLabel(program: ChurchProgram): string {
  const start = new Date(program.starts_at);
  if (Number.isNaN(start.getTime())) return "";
  const time = start.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: CHURCH_TIME_ZONE,
  });
  const end = program.ends_at ? new Date(program.ends_at) : null;
  const startDay = start.toLocaleDateString("en-GB", { timeZone: CHURCH_TIME_ZONE });
  const endDay = end && !Number.isNaN(end.getTime())
    ? end.toLocaleDateString("en-GB", { timeZone: CHURCH_TIME_ZONE })
    : startDay;
  return endDay !== startDay ? `${time} daily` : time;
}

export function programIsUpcoming(program: ChurchProgram, now = Date.now()): boolean {
  const end = new Date(program.ends_at || program.starts_at).getTime();
  return !Number.isNaN(end) && end >= now;
}

/** Shown if the API has not yet returned the live revival row. */
export const PINNED_PROGRAMS: ChurchProgram[] = [
  {
    id: "evt_igc_revival_oct2026",
    title: "Freedom from Jesus",
    description:
      "A three-day revival hosted by Prophet Michael Ugbede. Come expecting encounter, healing and deliverance — mighty are the works of God. 3:00pm daily.",
    type: "revival",
    starts_at: "2026-10-01T15:00:00+01:00",
    ends_at: "2026-10-03T18:00:00+01:00",
    location: "IGC Agbeji, Anyigba, Kogi State",
    image_url: "/programs/freedom-from-jesus-oct-2026.jpg",
  },
];

export function mergePrograms(fromApi: ChurchProgram[] | null | undefined): ChurchProgram[] {
  const api = fromApi ?? [];
  const missing = PINNED_PROGRAMS.filter((pinned) => !api.some((row) => row.id === pinned.id));
  return [...missing, ...api].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
}
