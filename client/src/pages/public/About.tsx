import { Sparkles } from "lucide-react";

export default function About() {
  return (
    <div>
      <section className="grace-gradient px-6 py-20 text-center">
        <h1 className="font-display text-4xl font-semibold text-white sm:text-5xl">
          About Our House
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-brand-100">
          Infinitely Graced Church is a community of believers passionate about the
          presence of God and the transformation of lives by His infinite grace.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="prose prose-lg max-w-none text-ink-600">
          <h2 className="font-display text-3xl text-ink-900">Our Mission</h2>
          <p className="mt-3">
            To raise a generation of grace-filled disciples who love God, love people, and
            impact their world through the finished works of Christ. We are committed to
            sound teaching, genuine worship, and compassionate service.
          </p>

          <h2 className="mt-10 font-display text-3xl text-ink-900">Our Vision</h2>
          <p className="mt-3">
            To be a spiritual home where every person — from the first-time visitor to the
            seasoned worker — grows into the fullness of who God created them to be, and is
            equipped to carry His grace everywhere they go.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Worship", "Encountering God in spirit and truth."],
              ["Discipleship", "Growing believers into maturity."],
              ["Community", "Doing life together in love."],
            ].map(([t, d]) => (
              <div
                key={t}
                className="rounded-2xl border border-ink-100 bg-white p-6 card-shadow"
              >
                <Sparkles className="h-6 w-6 text-gold-500" />
                <h3 className="mt-3 text-lg text-ink-900">{t}</h3>
                <p className="mt-1 text-sm text-ink-500">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
