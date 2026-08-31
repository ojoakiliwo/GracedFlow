import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock, MapPin, Sparkles } from "lucide-react";
import { useApi } from "../../lib/useApi";
import { Card } from "../../components/ui";
import { formatDateRange } from "../../lib/format";
import {
  mergePrograms,
  programIsUpcoming,
  programTimeLabel,
  programTypeLabel,
  type ChurchProgram,
} from "../../lib/programs";

export default function Programs() {
  const { data, loading } = useApi<ChurchProgram[]>("/public/events");
  const programs = mergePrograms(data);
  const upcoming = programs.filter((p) => programIsUpcoming(p));
  const past = programs.filter((p) => !programIsUpcoming(p)).reverse();
  const featured = upcoming[0];
  const rest = upcoming.slice(1);

  return (
    <div>
      <section className="grace-gradient px-6 py-16 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-gold-300" />
        <h1 className="mt-4 font-display text-4xl font-semibold text-white sm:text-5xl">
          Upcoming Programs
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-brand-100">
          Revivals, conferences and special gatherings of Infinitely Graced Church.
          This is where we post every flyer.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        {loading && !data ? (
          <p className="text-center text-ink-500">Loading programs…</p>
        ) : !featured ? (
          <Card className="p-10 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-brand-600" />
            <h2 className="mt-4 font-display text-2xl text-ink-900">No programs posted yet</h2>
            <p className="mt-2 text-ink-500">
              Watch this space — the next gathering will appear here with its flyer.
            </p>
          </Card>
        ) : (
          <>
            <FeaturedProgram program={featured} />
            {rest.length > 0 && (
              <div className="mt-12">
                <h2 className="font-display text-2xl text-ink-900">Also coming</h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  {rest.map((program) => (
                    <ProgramCard key={program.id} program={program} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {past.length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-2xl text-ink-900">Recent programs</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((program) => (
                <ProgramCard key={program.id} program={program} faded />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function FeaturedProgram({ program }: { program: ChurchProgram }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-2">
        <Link to={`/programs/${program.id}`} className="block bg-brand-950">
          {program.image_url ? (
            <img
              src={program.image_url}
              alt={`${program.title} flyer`}
              className="h-full max-h-[32rem] w-full object-cover object-center lg:max-h-none"
            />
          ) : (
            <div className="flex min-h-[16rem] items-center justify-center grace-gradient">
              <CalendarDays className="h-16 w-16 text-white/80" />
            </div>
          )}
        </Link>
        <div className="flex flex-col justify-center p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">
            {programTypeLabel(program.type)}
          </p>
          <h2 className="mt-2 font-display text-3xl text-ink-900 sm:text-4xl">{program.title}</h2>
          {program.description && (
            <p className="mt-4 text-ink-600">{program.description}</p>
          )}
          <ul className="mt-6 space-y-2 text-sm text-ink-600">
            <li className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 text-brand-700" />
              {formatDateRange(program.starts_at, program.ends_at)}
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 text-brand-700" />
              {programTimeLabel(program)}
            </li>
            {program.location && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-brand-700" />
                {program.location}
              </li>
            )}
          </ul>
          <Link
            to={`/programs/${program.id}`}
            className="mt-8 inline-flex w-fit items-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-800"
          >
            Open flyer & details <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

function ProgramCard({ program, faded }: { program: ChurchProgram; faded?: boolean }) {
  return (
    <Link to={`/programs/${program.id}`} className={faded ? "opacity-80" : undefined}>
      <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
        {program.image_url ? (
          <img
            src={program.image_url}
            alt={`${program.title} flyer`}
            className="aspect-[3/2] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[3/2] items-center justify-center bg-brand-50">
            <CalendarDays className="h-10 w-10 text-brand-600" />
          </div>
        )}
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">
            {programTypeLabel(program.type)}
          </p>
          <h3 className="mt-1 text-lg text-ink-900">{program.title}</h3>
          <p className="mt-1 text-sm text-ink-500">
            {formatDateRange(program.starts_at, program.ends_at)}
          </p>
          {program.location && <p className="text-sm text-ink-500">{program.location}</p>}
        </div>
      </Card>
    </Link>
  );
}
