import Link from "next/link";
import { Sparkles, ShieldCheck, Crosshair } from "lucide-react";

const highlights = [
  {
    icon: ShieldCheck,
    title: "Competitive Core",
    detail: "Squad prep, tactics lock, ranked climb.",
  },
  {
    icon: Crosshair,
    title: "Fast Match Flow",
    detail: "From login to kick-off in under a minute.",
  },
  {
    icon: Sparkles,
    title: "Live Market",
    detail: "Bid windows, price pressure, roster control.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh px-4 py-8 md:py-14 app-shell-bg">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[980px] flex-col justify-center gap-8 md:gap-10">
        <section className="glass-panel panel-enter rounded-2xl px-5 py-7 md:px-8 md:py-9">
          <p className="section-title">Tactics Duel Arena</p>
          <h1 className="mt-2 max-w-[20ch] font-mono text-2xl uppercase leading-tight text-text md:text-3xl">
            Build Your Club, Lock Your Shape, Rule Matchday.
          </h1>
          <p className="mt-3 max-w-[62ch] text-sm text-text-mid md:text-base">
            A competitive-first football manager experience where every tactical call,
            transfer decision, and ranked queue matters.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-[46px] items-center justify-center rounded-md bg-accent px-5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-black transition-all duration-150 hover:bg-accent-dim"
            >
              Start New Club
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[46px] items-center justify-center rounded-md border border-border px-5 font-mono text-xs uppercase tracking-[0.16em] text-text-mid transition-colors duration-150 hover:border-border-light hover:text-text"
            >
              Return To Dugout
            </Link>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {highlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="glass-panel panel-enter rounded-xl p-4"
                style={{ animationDelay: `${80 + index * 60}ms` }}
              >
                <Icon size={16} className="text-accent" strokeWidth={1.8} />
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-text">
                  {item.title}
                </p>
                <p className="mt-1 text-xs text-text-mid">{item.detail}</p>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
