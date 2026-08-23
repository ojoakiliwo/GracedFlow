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
import { formatDateTime } from "../../lib/format";
import { SERVICE_TIMES } from "../../lib/services";

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
  location: string;
}

export default function Home() {
  const { data: projects } = useApi<PublicProject[]>("/public/projects");
  const { data: events } = useApi<PublicEvent[]>("/public/events");

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

      {/* Events */}
      {events && events.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-8 text-center font-display text-3xl text-ink-900">
            Upcoming Gatherings
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {events.slice(0, 4).map((e) => (
              <Card key={e.id} className="flex items-center gap-4 p-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl grace-gradient text-white">
                  <CalendarDays className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-base text-ink-900">{e.title}</h3>
                  <p className="text-sm text-gold-600">{formatDateTime(e.starts_at)}</p>
                  <p className="text-sm text-ink-500">{e.location}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

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
        </div>
      </section>
    </div>
  );
}
