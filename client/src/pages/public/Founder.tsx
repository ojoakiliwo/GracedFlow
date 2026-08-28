import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  HeartHandshake,
  Music,
  PenLine,
  Quote,
  Sparkles,
} from "lucide-react";
import { Card } from "../../components/ui";

const roles = [
  { icon: Sparkles, title: "Prophet", body: "A voice calling people to reason with God and walk in His light." },
  { icon: BookOpen, title: "Author", body: "Writer of Is Jesus Necessary? — a reasoned case for the gospel." },
  { icon: HeartHandshake, title: "Counselor & Coach", body: "Walking with people as they recover identity, purpose, and peace in Christ." },
  { icon: Music, title: "Songwriter & Singer", body: "Worship that carries the same message he teaches: Jesus is enough." },
];

const pillars = [
  {
    title: "Jesus is necessary",
    body: "Not one option among many. He is the only way God restored what the fall broke — identity, authority, and fellowship with the Father.",
  },
  {
    title: "Grace, not striving",
    body: "Righteousness cannot be earned by rules. A sinless Saviour stood in our place, and those who believe are justified by His finished work.",
  },
  {
    title: "Faith that reasons",
    body: "God invites us to think: “Come now, and let us reason together.” Faith is not irrational. It is trust in a God whose justice and love both hold.",
  },
  {
    title: "A gospel for every person",
    body: "Jesus is for the whole world — including those raised in other faiths. Descent from Abraham is not enough; faith in the promised Messiah is.",
  },
];

export default function Founder() {
  return (
    <div>
      <section className="grace-gradient px-6 py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[auto_1fr]">
          <img
            src="/brand/prophet-michael-ugbede.jpg"
            alt="Prophet Michael Ugbede, Founding President of Infinitely Graced Church"
            className="mx-auto h-44 w-44 rounded-full object-cover ring-4 ring-gold-300/80 sm:h-56 sm:w-56"
          />
          <div className="text-center lg:text-left">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-gold-300">
              Infinitely Graced Church
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold text-white sm:text-5xl">
              Prophet Michael Ugbede
            </h1>
            <p className="mt-3 text-lg text-brand-100">
              Founding President &amp; Lead Pastor
            </p>
            <p className="mx-auto mt-5 max-w-2xl text-brand-100 lg:mx-0">
              Prophet, author, counselor, coach, songwriter and singer — raised to
              help people see why Jesus is not merely a figure of faith, but the
              essential answer to the human condition.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-gold-200 bg-gold-50/60 p-6 sm:p-8">
          <Quote className="h-8 w-8 text-gold-500" />
          <p className="mt-3 font-display text-xl leading-relaxed text-ink-800 sm:text-2xl">
            “Jesus is not just necessary; He is everything.”
          </p>
          <p className="mt-3 text-sm text-ink-500">
            From <em>Is Jesus Necessary?</em> — Ugbede Michael
          </p>
        </div>

        <h2 className="mt-14 font-display text-3xl text-ink-900">The call</h2>
        <div className="mt-4 space-y-4 text-ink-600">
          <p>
            Prophet Michael Ugbede grew up in a Christian home. His family helped
            establish the Catholic Church in their village; his grandparents even
            donated land for it. Faith was not a slogan in that house — it was the
            air he breathed. As a child he would say, simply, “It’s because Jesus is
            the best.”
          </p>
          <p>
            Around the age of seven, a crusade was held just across from the family
            house. Drawn by the keyboards, drums, guitars and the people on the
            microphone, he went alone. The next day he built a makeshift stage with
            ropes for cables and imitated what he had seen. That night planted a
            love for anything related to Jesus that never left him.
          </p>
          <p>
            A few years later, during Easter, a Muslim peer mocked the death of
            Jesus and asked why God did not simply defeat the devil. The challenge
            opened a well of questions: Why must we go through Jesus? Why pray in
            His name? Why didn’t God just make everything perfect? Those questions
            did not drive him from the faith. They drove him to understand it — and
            to help others who leave Christianity, or never enter it, because Jesus
            has never been made to make sense.
          </p>
          <p>
            That burden became a book, a pulpit, and a commission:{" "}
            <Link to="/about" className="font-medium text-brand-700 hover:underline">
              Infinitely Graced Church
            </Link>
            , which he founded in February 2025 as Founding President and Head
            Pastor, responsible for the leadership of the house.
          </p>
        </div>
      </section>

      <section className="bg-ink-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center font-display text-3xl text-ink-900">
            How he serves
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-ink-500">
            One calling, expressed through teaching, writing, counsel, and worship.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((r) => (
              <Card key={r.title} className="p-6">
                <r.icon className="h-6 w-6 text-gold-500" />
                <h3 className="mt-3 text-lg text-ink-900">{r.title}</h3>
                <p className="mt-1.5 text-sm text-ink-500">{r.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center font-display text-3xl text-ink-900">
          The message he carries
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-ink-500">
          Drawn from years of questioning, studying, and writing so that belief in
          Jesus would rest on both Scripture and sound reason.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {pillars.map((p) => (
            <Card key={p.title} className="p-6">
              <h3 className="text-lg text-ink-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{p.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-brand-50/70 py-16">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-gold-600">
              The book
            </p>
            <h2 className="mt-2 font-display text-3xl text-ink-900">
              Is Jesus Necessary?
            </h2>
            <p className="mt-4 max-w-xl text-ink-600">
              A walk through the fall of man, the fracture of body, soul and
              spirit, the authority lost to the prince of this world, and why the
              birth, death and resurrection of Jesus were not optional — they were
              required. Written so that anyone, including a sincere seeker from
              another faith, can reason through the gospel and receive Christ.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-ink-600">
              {[
                "Who Jesus is — fully God, fully man, Saviour of the world",
                "What the fall actually cost humanity",
                "How believing in Jesus saves — in plain, logical terms",
                "How to receive Him: repentance, faith, confession, new life",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="mx-auto flex h-64 w-44 flex-col justify-between rounded-xl grace-gradient p-5 text-white shadow-lg ring-1 ring-white/20">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold-300">
              Ugbede Michael
            </p>
            <div>
              <p className="font-display text-2xl font-semibold leading-tight">
                Is Jesus Necessary?
              </p>
              <p className="mt-3 text-xs text-brand-100">
                Why His birth, death and resurrection had to happen.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="font-display text-3xl text-ink-900">Connect</h2>
        <p className="mt-3 text-ink-600">
          Follow the ministry and sit under the Word. Public profiles currently
          confirmed for Prophet Michael Ugbede:
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="https://www.linkedin.com/in/michaelugbede"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-800"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
            </svg>
            LinkedIn
          </a>
          <a
            href="https://www.facebook.com/oracleugbede"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-800"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07z" />
            </svg>
            Facebook
          </a>
        </div>
        <p className="mt-4 text-xs text-ink-400">
          Additional Instagram, YouTube or X accounts can be added here once official
          ministry handles are confirmed.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grace-gradient-gold flex flex-col items-center gap-4 rounded-3xl px-8 py-14 text-center">
          <h2 className="max-w-xl font-display text-3xl font-semibold text-white">
            Sit with us this week
          </h2>
          <p className="max-w-lg text-sm text-brand-100">
            Sundays 9:00 AM · Wednesday prayer 5:30 PM
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/about"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-medium text-brand-800 transition hover:bg-brand-50"
            >
              About the church <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/prayer"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3 font-medium text-white ring-1 ring-white/30 transition hover:bg-white/20"
            >
              Request prayer
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
