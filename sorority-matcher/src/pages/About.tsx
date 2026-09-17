import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles, Scale, Ruler, Users } from 'lucide-react';

const missionItems = [
  {
    icon: Sparkles,
    title: 'Streamline the big-little process',
    body: 'One shared flow for collegiate fraternities and sororities — collect preferences, run the match, done.',
  },
  {
    icon: Scale,
    title: 'Take bias out of the matching',
    body: 'Every ranking is weighed by the same math. No one gets a nudge; no one gets left behind.',
  },
  {
    icon: Ruler,
    title: 'Standardize chapter practices',
    body: 'A repeatable process so every semester feels fair to everyone joining and everyone matching.',
  },
];

const steps = [
  {
    label: 'Pass 01',
    title: 'Mutual-first-choice matches',
    body:
      'We start by locking in every mutual first-choice pair. If a Big ranks a Little #1 AND that Little ranks the Big #1, we pair them immediately. These are the strongest possible matches and always make the final results.',
  },
  {
    label: 'Pass 02',
    title: 'Deferred acceptance — the NRMP algorithm',
    body:
      'For everyone else, we run deferred acceptance — the same stable-matching algorithm the National Resident Matching Program uses to place medical residents. Littles propose to their top-ranked remaining Big; each Big holds their best offer(s) and only lets go when a better-ranked Little proposes. This repeats until every Little is matched, guaranteeing a stable result.',
  },
  {
    label: 'Pass 03',
    title: 'Twins, when the chapter wants them',
    body:
      'If a Big signals they can take twins, they stay in the pool after their first match and only leave once a second Little pairs with them. Twin support gives chapters flexibility without breaking the guarantees of the earlier passes.',
  },
];

const promises = [
  'Perfect matches (mutual first choices) are always preserved',
  'Deferred acceptance guarantees a stable outcome — no pair would both rather be with each other',
  'Every Little gets the best Big they could get in any stable matching',
  'Twin support adds flexibility without sacrificing match quality',
];

const About = () => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost relative w-full max-w-3xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-14 md:pt-10 md:pb-16 flex flex-col overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[color:var(--ss-jade)] opacity-[0.07] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-[color:var(--ss-jade-soft)] opacity-[0.06] blur-3xl"
        />

        <header className="relative flex items-center justify-between mb-10">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2 text-sm min-h-[36px] rounded-pill border border-[color:var(--ss-jade-line)] bg-transparent text-[color:var(--ss-ink-2)] font-medium hover:bg-white/60 transition-colors whitespace-nowrap"
          >
            <ArrowLeft size={14} /> Back to home
          </Link>
        </header>

        <div className="relative text-center mb-14">
          <span className="ss-kicker">How Sorora works</span>
          <h1 className="mt-2 font-display text-[38px] md:text-[52px] leading-[1.05] font-medium text-[color:var(--ss-ink-1)]">
            Matches you can trust,
            <br />
            <span className="italic text-[color:var(--ss-jade-soft)]">math that stays out of the way.</span>
          </h1>
        </div>

        <div className="relative flex flex-col gap-6">
          {/* Our mission */}
          <section className="relative rounded-[20px] bg-white/60 border border-[color:var(--ss-surface-border)] p-6 md:p-8 shadow-[0_10px_30px_-25px_rgba(15,45,32,0.4)]">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--ss-jade-soft)]" />
              <div className="ss-kicker">Our mission</div>
            </div>
            <h2 className="font-display text-[26px] md:text-[28px] font-medium text-[color:var(--ss-ink-1)]">
              What we're building for.
            </h2>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {missionItems.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="group rounded-2xl border border-[color:var(--ss-surface-border)] bg-white/70 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_25px_-20px_rgba(15,45,32,0.5)]"
                >
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--ss-pill-bg)] text-[color:var(--ss-jade-deep)]">
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-[color:var(--ss-ink-1)]">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[color:var(--ss-ink-5)]">{body}</p>
                </div>
              ))}
            </div>

            <p className="mt-6 pt-5 border-t border-[color:var(--ss-surface-border)] text-sm leading-relaxed text-[color:var(--ss-ink-4)]">
              Sorora uses a smart matching algorithm to create the best possible Big–Little pairings based on mutual
              preferences.
            </p>
          </section>

          {/* How it works — timeline */}
          <section className="relative rounded-[20px] bg-white/60 border border-[color:var(--ss-surface-border)] p-6 md:p-8 shadow-[0_10px_30px_-25px_rgba(15,45,32,0.4)]">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--ss-jade-soft)]" />
              <div className="ss-kicker">How it works</div>
            </div>
            <h2 className="font-display text-[26px] md:text-[28px] font-medium text-[color:var(--ss-ink-1)]">
              Three passes over your preferences.
            </h2>

            <ol className="mt-6">
              {steps.map((step, i) => {
                const isLast = i === steps.length - 1;
                return (
                  <li
                    key={step.label}
                    className="grid grid-cols-[2rem_1fr] md:grid-cols-[2.25rem_1fr] gap-x-4 items-start"
                  >
                    <div className="flex flex-col items-center self-stretch">
                      <span className="inline-flex h-8 w-8 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--ss-jade-deep)] text-white text-[11px] md:text-xs font-semibold shadow-[0_4px_12px_-4px_rgba(15,45,32,0.6)]">
                        {step.label.slice(-2)}
                      </span>
                      {!isLast && (
                        <span aria-hidden className="mt-1 w-px flex-1 bg-[color:var(--ss-jade-line)]" />
                      )}
                    </div>
                    <div className={isLast ? '' : 'pb-6'}>
                      <div className="ss-kicker text-[color:var(--ss-jade-soft)]">{step.label}</div>
                      <h3 className="mt-0.5 text-[15px] font-semibold text-[color:var(--ss-ink-1)]">{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--ss-ink-4)]">{step.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Why it works — checkmark rows */}
          <section className="relative rounded-[20px] bg-[color:var(--ss-jade-deep)] text-white p-6 md:p-8 shadow-[0_20px_50px_-30px_rgba(15,45,32,0.7)] overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/5 blur-2xl"
            />
            <div className="relative flex items-center gap-2 mb-1">
              <Users size={14} className="text-white/70" />
              <div className="ss-kicker text-white/80">Why it works</div>
            </div>
            <h2 className="relative font-display text-[26px] md:text-[28px] font-medium">
              Stable in theory, fair in practice.
            </h2>

            <ul className="relative mt-6 grid gap-3 md:grid-cols-2">
              {promises.map(item => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-xl bg-white/10 backdrop-blur-sm p-3 border border-white/10"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/90 text-[color:var(--ss-jade-deep)]">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="text-sm leading-relaxed text-white/90">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
};

export default About;
