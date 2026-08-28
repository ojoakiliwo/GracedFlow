import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card } from "../../components/ui";

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
        <h2 className="font-display text-3xl text-ink-900">Who we are</h2>
        <p className="mt-3 text-ink-600">
          We are a family flowing in His infinite grace — reaching lives, building
          people, and transforming our community for Christ. This house exists so
          that people who have questions about Jesus can find answers, and people
          who already believe can grow into the fullness of who God created them
          to be.
        </p>
        <p className="mt-4 text-ink-600">
          Infinitely Graced Church was founded in February 2025 by{" "}
          <Link to="/founder" className="font-medium text-brand-700 hover:underline">
            Prophet Michael Ugbede
          </Link>
          , our Founding President and Lead Pastor. The church is the living
          expression of a calling that began in 2003, when he encountered God:
          Jesus is not optional. He is necessary.
        </p>

        <h2 className="mt-12 font-display text-3xl text-ink-900">Our Mission</h2>
        <p className="mt-3 text-ink-600">
          To raise a generation of grace-filled disciples who love God, love people,
          and impact their world through the finished works of Christ. We are
          committed to sound teaching, genuine worship, and compassionate service.
        </p>

        <h2 className="mt-10 font-display text-3xl text-ink-900">Our Vision</h2>
        <p className="mt-3 text-ink-600">
          To be a spiritual home where every person — from the first-time visitor to
          the seasoned worker — grows into the fullness of who God created them to
          be, and is equipped to carry His grace everywhere they go.
        </p>

        <h2 className="mt-10 font-display text-3xl text-ink-900">What we believe</h2>
        <p className="mt-3 text-ink-600">
          Our teaching rests on the gospel Prophet Ugbede unfolds in{" "}
          <em>Is Jesus Necessary?</em> — that humanity fell, authority was lost,
          and only a sinless Saviour could restore us to God — and on the work of{" "}
          <em>Science and Spirituality</em>, that the God who made the universe is
          the same God who reveals Himself.
        </p>
        <ul className="mt-4 space-y-3 text-ink-600">
          <li>
            <strong className="text-ink-800">Jesus is fully God and fully man</strong>{" "}
            — the only mediator who can reconcile us to the Father.
          </li>
          <li>
            <strong className="text-ink-800">Salvation is by grace through faith</strong>{" "}
            — not by religious performance. His death and resurrection are a
            finished work we receive.
          </li>
          <li>
            <strong className="text-ink-800">The whole person is being restored</strong>{" "}
            — body, soul and spirit brought back under the lordship of Christ.
          </li>
          <li>
            <strong className="text-ink-800">This gospel is for every human being</strong>{" "}
            — every culture, every background, every previous belief.
          </li>
        </ul>

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
      </section>

      <section className="bg-ink-50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <Card className="overflow-hidden">
            <div className="grid md:grid-cols-[1fr_auto]">
              <div className="p-8 sm:p-10">
                <p className="text-sm font-semibold uppercase tracking-widest text-gold-600">
                  Leadership
                </p>
                <h2 className="mt-2 font-display text-3xl text-ink-900">
                  About the Founding President
                </h2>
                <p className="mt-4 max-w-xl text-ink-600">
                  Prophet Michael Ugbede is a prophet, author, counselor, coach,
                  songwriter and singer. In 2003, after nine hours of prayer, he
                  encountered God — and since then the Lord has healed and delivered
                  people and communities through him. He is the author of{" "}
                  <em>Is Jesus Necessary?</em> and <em>Science and Spirituality</em>.
                </p>
                <Link
                  to="/founder"
                  className="mt-6 inline-flex items-center gap-2 font-medium text-brand-700 hover:text-brand-900"
                >
                  Read his story <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="relative min-h-[240px] bg-brand-950 md:w-72">
                <img
                  src="/brand/prophet-michael-ugbede.jpg"
                  alt="Prophet Michael Ugbede, Founding President"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
