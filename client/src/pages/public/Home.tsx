import { Link } from "react-router-dom";
import {
  ArrowRight,
  HandCoins,
  HeartHandshake,
  Sparkles,
  CalendarDays,
  Users,
} from "lucide-react";
import { useApi } from "../../lib/useApi";
import { Card } from "../../components/ui";
import { formatDateRange, formatDateTime } from "../../lib/format";
import { SERVICE_TIMES } from "../../lib/services";
import { ChurchContactLinks } from "../../components/ChurchContact";
import {
  mergePrograms,
  programIsUpcoming,
  programTypeLabel,
  type ChurchProgram,
} from "../../lib/programs";

interface PublicProject {
  id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
}
interface PublicEvent {
  id: string;
  title: string;
  description: string;
  type: string;
  starts_at: string;
  ends_at?: string | null;
  location: string;
  image_url?: string | null;
}

export default function Home() {
  const { data: projects } = useApi<PublicProject[]>("/public/projects");
  const { data: events } = useApi<PublicEvent[]>("/public/events");
  const upcomingPrograms = mergePrograms(events as ChurchProgram[] | null).filter(programIsUpcoming);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden grace-gradient">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_0,white,transparent_30%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white ring-1 ring-white/20">
            <Sparkles className="h-4 w-4 text-gold-300" /> Flowing in His infinite grace
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl font-semibold leading-tight text-white sm:text-6xl">
            Welcome to <span className="text-gold-300">Infinitely Graced</span> Church
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-brand-100">
            A family reaching lives, building people and transforming our community for
            Christ. There is a place for you here.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/give"
              className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-6 py-3 font-medium text-white transition hover:bg-gold-600"
            >
              <HandCoins className="h-5 w-5" /> Give Online
            </Link>
            <Link
              to="/prayer"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3 font-medium text-white ring-1 ring-white/25 transition hover:bg-white/20"
            >
              <HeartHandshake className="h-5 w-5" /> Request Prayer
            </Link>
          </div>
        </div>
      </section>

      {/* Service times */}
      <section className="relative z-10 mx-auto -mt-12 max-w-5xl px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {SERVICE_TIMES.map((s) => (
            <Card key={s.name} className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg text-ink-900">{s.name}</h3>
                  <p className="mt-1 text-base font-semibold text-brand-800">{s.time}</p>
                  <p className="mt-1 text-sm text-ink-500">{s.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Users, title: "Belong", body: "Find community in our departments, cell groups and worker family." },
            { icon: Sparkles, title: "Grow", body: "Journey from new convert to established believer through discipleship." },
            { icon: HeartHandshake, title: "Serve", body: "Discover your gifts and serve God with excellence across our ministries." },
          ].map((v) => (
            <div key={v.title} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                <v.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-xl text-ink-900">{v.title}</h3>
              <p className="mt-2 text-sm text-ink-500">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Projects */}
      {projects && projects.length > 0 && (
        <section className="bg-ink-50 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-8 text-center">
              <h2 className="font-display text-3xl text-ink-900">Our Kingdom Projects</h2>
              <p className="mt-2 text-ink-500">
                Partner with the vision God has given to our house.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {projects.slice(0, 3).map((p) => (
                <Card key={p.id} className="flex flex-col p-6">
                  <span className="inline-flex w-fit rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium capitalize text-brand-700">
                    {p.status}
                  </span>
                  <h3 className="mt-3 text-lg text-ink-900">{p.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-ink-500">{p.description}</p>
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full grace-gradient"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-ink-400">{p.progress}% funded</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Upcoming programs */}
      {upcomingPrograms.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">
                This house
              </p>
              <h2 className="font-display text-3xl text-ink-900">Upcoming programs</h2>
            </div>
            <Link
              to="/programs"
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-900"
            >
              All programs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {upcomingPrograms.slice(0, 2).map((program) => (
              <Link key={program.id} to={`/programs/${program.id}`}>
                <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                  {program.image_url ? (
                    <img
                      src={program.image_url}
                      alt={`${program.title} flyer`}
                      className="aspect-[16/10] w-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center gap-4 p-5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl grace-gradient text-white">
                        <CalendarDays className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">
                          {programTypeLabel(program.type)}
                        </p>
                        <h3 className="text-base text-ink-900">{program.title}</h3>
                        <p className="text-sm text-gold-600">{formatDateTime(program.starts_at)}</p>
                        <p className="text-sm text-ink-500">{program.location}</p>
                      </div>
                    </div>
                  )}
                  {program.image_url && (
                    <div className="p-5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">
                        {programTypeLabel(program.type)}
                      </p>
                      <h3 className="mt-1 text-lg text-ink-900">{program.title}</h3>
                      <p className="mt-1 text-sm text-ink-500">
                        {formatDateRange(program.starts_at, program.ends_at)}
                      </p>
                      {program.location && (
                        <p className="text-sm text-ink-500">{program.location}</p>
                      )}
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Founder */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <Card className="flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center">
          <img
            src="/brand/prophet-michael-ugbede.jpg"
            alt="Prophet Michael Ugbede"
            className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-gold-200"
          />
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">
              Founding President
            </p>
            <h2 className="mt-1 text-xl text-ink-900">Prophet Michael Ugbede</h2>
            <p className="mt-1 text-sm text-ink-500">
              Prophet, author, counselor, coach, songwriter and singer — encountered
              by God in 2003, and still used to heal and deliver.
            </p>
          </div>
          <Link
            to="/founder"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-800"
          >
            His story <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grace-gradient-gold flex flex-col items-center gap-4 rounded-3xl px-8 py-14 text-center">
          <h2 className="max-w-xl font-display text-3xl font-semibold text-white">
            Take your next step with us this week
          </h2>
          <Link
            to="/prayer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-medium text-brand-800 transition hover:bg-brand-50"
          >
            Connect with us <ArrowRight className="h-5 w-5" />
          </Link>
          <ChurchContactLinks tone="onColor" align="center" className="mt-2" />
        </div>
      </section>
    </div>
  );
}
