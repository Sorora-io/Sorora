import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';

const steps = [
  { title: 'Start with the submitted preferences', body: 'Sorora uses rankings and chapter rules to suggest pairings. Treat the results as a consistent starting point, not a judgment of anyone’s worth.' },
  { title: 'Review the people behind the results', body: 'Check unmatched members and flagged pairs first. The algorithm cannot know every circumstance; use relevant context, rather than familiarity or first impressions, when considering a change.' },
  { title: 'Make a thoughtful plan', body: 'Confirm the pairs you have reviewed. If a change is needed, agree on a clear reason and apply the same standard to everyone. Coordinate your chapter’s reveal once your review is complete.' },
];
export default function MatchingNextSteps() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  return <section aria-label="Matching next steps" className="mt-6 border-y border-[color:var(--ss-jade-line)] py-5">
    {done ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">Your next step: review and confirm the pairings below</p><Button variant="ghost" size="sm" onClick={() => { setStep(0); setDone(false); }}>Review guidance</Button></div> : <>
      <p className="ss-caption">Before your chapter’s reveal · {step + 1} of {steps.length}</p>
      <h2 tabIndex={-1} className="mt-2 font-semibold text-lg" aria-live="polite">{steps[step].title}</h2>
      <p className="mt-2 text-sm leading-relaxed">{steps[step].body} <Link className="underline underline-offset-4" to="/about">How Sorora works</Link></p>
      <div className="mt-4 flex flex-wrap justify-between gap-3"><Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        <Button size="sm" onClick={() => step < steps.length - 1 ? setStep(step + 1) : setDone(true)}>{step < steps.length - 1 ? 'Continue' : 'Review pairings'}</Button></div>
    </>}
  </section>;
}
