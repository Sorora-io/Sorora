import { useState, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';
import { SceneDots } from './SceneShell';
import { MembershipWithGroup, isEffectiveAdmin } from '../lib/groups';

// Post-signup welcome + 4-step guided tour from the sorora-story canvas.
// Rendered by the Dashboard when a first-time-approved member lands there
// and hasn't seen the tour yet. Each step is its own scene sharing the
// frosted panel, so the visitor's mental model of "one screen at a time"
// carries all the way through.

interface WelcomeTourProps {
  membership: MembershipWithGroup;
  firstName: string;
  onFinish: () => void;
  onReplay?: () => void;
}

type Step = 'welcome' | 0 | 1 | 2 | 3 | 'end';

interface TourStep {
  kicker: string;
  heading: string;
  body: string;
  preview: ReactNode;
}

const oppositePlural = (role: string) => (role === 'big' ? 'littles' : 'Bigs');

const PreviewSurface = ({ children }: { children: ReactNode }) => (
  <div className="ss-surface w-full max-w-md mt-8 text-left">{children}</div>
);

const WelcomeTour = ({ membership, firstName, onFinish }: WelcomeTourProps) => {
  const [step, setStep] = useState<Step>('welcome');

  const roleLabel =
    membership.role === 'big'
      ? 'Big'
      : membership.role === 'little'
      ? 'Little'
      : isEffectiveAdmin(membership)
      ? 'Admin'
      : 'Member';
  const targetPlural = oppositePlural(membership.role);
  const deadlineLabel = membership.group.ranking_deadline
    ? new Date(membership.group.ranking_deadline + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
      })
    : 'TBD';

  const tourSteps: TourStep[] = [
    {
      kicker: 'YOUR TOUR · 1 / 4 · PROFILE',
      heading: 'Make it yours.',
      body: 'Add a little more to your profile so people in your chapter can find you and put a face to your name.',
      preview: (
        <>
          <h3 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
            {firstName || 'Your'} {firstName ? '' : 'name'}
          </h3>
          <span className="ss-pill mt-2">{roleLabel}</span>
          <p className="ss-caption mt-3">
            Photo, major, year, a short bio. Add these whenever you're ready.
          </p>
        </>
      ),
    },
    {
      kicker: 'YOUR TOUR · 2 / 4 · RANKINGS',
      heading:
        membership.role === 'admin'
          ? 'Your chapter’s preferences, in one place.'
          : `Your ${targetPlural}, in your order.`,
      body:
        membership.role === 'admin'
          ? "Members submit their own rankings and you see what's ready to match on."
          : `Start ranking the ${targetPlural.toLowerCase()} you’ve met. Move people up or down, then review your preferences before submitting.`,
      preview: (
        <>
          <h3 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
            My {targetPlural.toLowerCase()} rankings
          </h3>
          <div className="mt-3 flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
            {['Maya', 'Elena', 'Sophie'].map((n, i) => (
              <div key={n} className="flex items-center gap-3 py-2 text-[color:var(--ss-ink-2)]">
                <span className="w-5 text-right text-[color:var(--ss-ink-5)] tabular-nums">
                  {i + 1}
                </span>
                {n}
              </div>
            ))}
          </div>
          <p className="ss-caption mt-3">Example list · Ranking deadline: {deadlineLabel}</p>
        </>
      ),
    },
    {
      kicker: 'YOUR TOUR · 3 / 4 · ROSTER',
      heading: 'Your whole chapter, here.',
      body:
        'The roster is where you can see everyone in your organization. Open a profile to learn who’s who.',
      preview: (
        <>
          <h3 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
            Chapter roster
          </h3>
          <div className="mt-3 flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
            {[
              { n: 'Maya', r: 'Big' },
              { n: 'Elena', r: 'Big' },
              { n: 'Sophie', r: 'Little' },
            ].map(({ n, r }) => (
              <div key={n} className="flex items-center gap-3 py-2 text-[color:var(--ss-ink-2)]">
                <span className="w-8 h-8 rounded-full bg-[color:var(--ss-pill-bg)] text-[color:var(--ss-jade)] flex items-center justify-center text-sm font-medium">
                  {n[0]}
                </span>
                {n} · {r}
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      kicker: 'YOUR TOUR · 4 / 4 · FAQ',
      heading: 'Questions have a home, too.',
      body: 'Visit the FAQ whenever you need help with rankings, submissions, or what happens next.',
      preview: (
        <>
          <h3 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
            Frequently asked questions
          </h3>
          <div className="mt-3 flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
            {[
              'Can I update my rankings?',
              'Who can see my preferences?',
              'When will matches be announced?',
            ].map(q => (
              <p key={q} className="py-2 text-[color:var(--ss-ink-2)]">
                {q}
              </p>
            ))}
          </div>
        </>
      ),
    },
  ];

  // -----------------------------------------------------------------------
  // Welcome scene
  // -----------------------------------------------------------------------
  if (step === 'welcome') {
    return (
      <div className="w-full flex flex-col items-center text-center">
        <h1 className="font-display italic text-[38px] md:text-[52px] leading-[1.05] font-medium text-[color:var(--ss-ink-1)]">
          You’re going to be a {roleLabel}!
        </h1>
        <p className="mt-5 max-w-lg text-[color:var(--ss-ink-5)] text-lg leading-relaxed">
          Welcome{firstName ? `, ${firstName}` : ''}. This is such an exciting time. Let’s show
          you around your chapter’s space, so you know where everything is when you need it.
        </p>
        <p className="ss-caption mt-6">Chapter timeline: {deadlineLabel}</p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <Button size="lg" onClick={() => setStep(0)}>
            Show me around
          </Button>
          <button type="button" onClick={onFinish} className="ss-link">
            Skip the tour
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // End scene
  // -----------------------------------------------------------------------
  if (step === 'end') {
    return (
      <div className="w-full flex flex-col items-center text-center">
        <h1 className="font-display text-[38px] md:text-[52px] leading-[1.05] font-medium text-[color:var(--ss-ink-1)]">
          Come back when you’re ready to rank.
        </h1>
        <p className="mt-5 max-w-lg text-[color:var(--ss-ink-5)] text-lg leading-relaxed">
          You’re all set{firstName ? `, ${firstName}` : ''}. Your profile, {targetPlural.toLowerCase()} rankings, roster, and FAQ will be right here.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <Button size="lg" onClick={onFinish}>
            Go to my dashboard
          </Button>
          <button type="button" onClick={() => setStep(3)} className="ss-link">
            Back
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Tour step
  // -----------------------------------------------------------------------
  const idx = step as number;
  const s = tourSteps[idx];
  const isLast = idx === tourSteps.length - 1;

  return (
    <div className="w-full flex flex-col items-center text-center">
      <span className="ss-kicker">{s.kicker}</span>
      <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
        {s.heading}
      </h1>
      <p className="mt-4 max-w-lg text-[color:var(--ss-ink-5)] text-base leading-relaxed">
        {s.body}
      </p>
      <PreviewSurface>{s.preview}</PreviewSurface>

      <div className="mt-10 flex flex-col items-center gap-4">
        <Button
          size="lg"
          onClick={() => setStep(isLast ? 'end' : ((idx + 1) as Step))}
        >
          {isLast ? 'Finish my tour' : 'Continue'}
        </Button>
        <SceneDots current={idx} total={tourSteps.length} />
        <button
          type="button"
          onClick={() => setStep(idx === 0 ? 'welcome' : ((idx - 1) as Step))}
          className="ss-link"
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default WelcomeTour;

// Small helper used by Dashboard to decide whether to render the tour.
// Exported alongside so both files agree on the same storage key.
export const WELCOME_TOUR_KEY = 'welcome-tour-v1';

// Convenience re-export so callers don't need to import Link separately
// when composing the tour end-screen alongside their own copy.
export { Link };
