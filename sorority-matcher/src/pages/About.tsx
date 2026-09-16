import { Link } from 'react-router-dom';

const About = () => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-3xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <header className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Link
            to="/"
            className="text-sm text-[color:var(--ss-ink-4)] hover:text-[color:var(--ss-ink-1)] underline underline-offset-4"
          >
            Back to home
          </Link>
        </header>

        <div className="text-center mb-10">
          <span className="ss-kicker">How it works</span>
          <h1 className="font-display text-[38px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
            Matches you can trust,<br />math that stays out of the way.
          </h1>
          <p className="mt-4 ss-caption max-w-lg mx-auto">
            The algorithm behind Sorora, in plain words.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <section className="ss-surface">
            <div className="ss-kicker" style={{ marginBottom: 4 }}>Our mission</div>
            <h2 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
              What we're building for.
            </h2>
            <div className="mt-3 space-y-1.5 text-sm text-[color:var(--ss-ink-4)]">
              <p>1. Streamline and optimize the big-little process for collegiate fraternities and sororities</p>
              <p>2. Eliminate potential biases in the matching process</p>
              <p>3. Standardize sorority practices</p>
            </div>
            <p className="mt-4 pt-4 border-t border-[color:var(--ss-surface-border)] text-sm text-[color:var(--ss-ink-4)]">
              Sorora uses a smart matching algorithm to create the best possible Big-Little pairings
              based on mutual preferences.
            </p>
          </section>

          <section className="ss-surface">
            <div className="ss-kicker" style={{ marginBottom: 4 }}>How it works</div>
            <h2 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
              Three passes over your preferences.
            </h2>

            <div className="mt-4 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--ss-ink-2)] mb-1">
                  1. Mutual-first-choice matches
                </h3>
                <p className="text-sm leading-relaxed text-[color:var(--ss-ink-4)]">
                  We start by identifying all mutual first-choice pairings. If a Big ranks a Little as
                  their #1 choice AND that Little ranks the Big as their #1 choice, we immediately
                  create that pairing. These are the strongest possible matches and are guaranteed to
                  be included in the final results.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[color:var(--ss-ink-2)] mb-1">
                  2. Deferred acceptance (the NRMP algorithm)
                </h3>
                <p className="text-sm leading-relaxed text-[color:var(--ss-ink-4)]">
                  For everyone else, we run deferred acceptance — the same stable-matching algorithm
                  the National Resident Matching Program (NRMP) uses to place medical residents.
                  Littles propose to their top-ranked remaining Big; each Big holds onto their best
                  offer(s) so far and only lets go of a held Little if a better-ranked one proposes
                  later. This repeats until every Little is matched, guaranteeing a stable result: no
                  unmatched Big/Little pair would both rather be with each other than who they ended
                  up with.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[color:var(--ss-ink-2)] mb-1">3. Twins</h3>
                <p className="text-sm leading-relaxed text-[color:var(--ss-ink-4)]">
                  If a Big indicates they are willing to take twins, after their first match, they will
                  remain in the matching pool. They are removed after their second match.
                </p>
              </div>
            </div>
          </section>

          <section className="ss-surface">
            <div className="ss-kicker" style={{ marginBottom: 4 }}>Why it works</div>
            <h2 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
              Stable in theory, fair in practice.
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed list-disc list-inside text-[color:var(--ss-ink-4)]">
              <li>Perfect matches (mutual first choices) are always preserved</li>
              <li>Deferred acceptance — the same algorithm the NRMP uses to match medical residents — guarantees a stable outcome</li>
              <li>No Big and Little who'd both rather be paired with each other are ever left unmatched with someone else</li>
              <li>Every Little gets the best Big they could get in any stable matching</li>
              <li>Twin support allows flexibility without sacrificing match quality</li>
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
};

export default About;
