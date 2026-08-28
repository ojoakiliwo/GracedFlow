import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock, MapPin, UserRound } from "lucide-react";
import { useApi } from "../../lib/useApi";
import { Card, Spinner } from "../../components/ui";
import { formatDateRange } from "../../lib/format";
import {
  PINNED_PROGRAMS,
  programTimeLabel,
  programTypeLabel,
  type ChurchProgram,
} from "../../lib/programs";

export default function ProgramDetail() {
  const { id } = useParams();
  const { data, loading, error } = useApi<ChurchProgram>(id ? `/public/events/${id}` : null);
  const program = data ?? PINNED_PROGRAMS.find((p) => p.id === id);

  if (loading && !program) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-display text-3xl text-ink-900">Program not found</h1>
        <p className="mt-2 text-ink-500">{error || "This flyer is no longer posted."}</p>
        <Link to="/programs" className="mt-6 inline-flex items-center gap-2 text-brand-700">
          <ArrowLeft className="h-4 w-4" /> All programs
        </Link>
      </div>
    );
  }

  return (
    <div>
      <section className="bg-brand-950 px-6 py-8 text-brand-100">
        <div className="mx-auto max-w-6xl">
          <Link to="/programs" className="inline-flex items-center gap-2 text-sm text-brand-200 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All programs
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-gold-400">
            {programTypeLabel(program.type)}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-white sm:text-5xl">
            {program.title}
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
          <Card className="overflow-hidden bg-ink-950">
            {program.image_url ? (
              <a href={program.image_url} target="_blank" rel="noreferrer">
                <img
                  src={program.image_url}
                  alt={`${program.title} flyer`}
                  className="w-full object-contain"
                />
              </a>
            ) : (
              <div className="flex min-h-[20rem] items-center justify-center grace-gradient">
                <CalendarDays className="h-16 w-16 text-white/80" />
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="font-display text-xl text-ink-900">When & where</h2>
              <ul className="mt-4 space-y-3 text-sm text-ink-600">
                <li className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-brand-700" />
                  {formatDateRange(program.starts_at, program.ends_at)}
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 text-brand-700" />
                  {programTimeLabel(program)}
                </li>
                {program.location && (
                  <li className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-brand-700" />
                    {program.location}
                  </li>
                )}
                {program.id === "evt_igc_revival_oct2026" && (
                  <li className="flex items-start gap-3">
                    <UserRound className="mt-0.5 h-4 w-4 text-brand-700" />
                    Host: Prophet Michael Ugbede
                  </li>
                )}
              </ul>
              {program.description && <p className="mt-4 text-ink-600">{program.description}</p>}
            </Card>

            <div className="flex flex-col gap-3">
              <Link
                to="/prayer"
                className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-5 py-3 text-sm font-medium text-white hover:bg-brand-800"
              >
                Request prayer
              </Link>
              <Link
                to="/founder"
                className="inline-flex items-center justify-center rounded-xl bg-gold-500 px-5 py-3 text-sm font-medium text-white hover:bg-gold-600"
              >
                About the host
              </Link>
              <Link
                to="/give"
                className="inline-flex items-center justify-center rounded-xl border border-ink-200 px-5 py-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                Partner with this program
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
