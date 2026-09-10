import { useState, useEffect, useCallback } from 'react';

export interface TourStep {
  // Matches an element's data-tour attribute.
  target: string;
  title: string;
  body: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const CARD_WIDTH = 320;
const MARGIN = 16;

const measure = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

const findTarget = (target: string) => document.querySelector(`[data-tour="${target}"]`);

const OnboardingTour = ({
  steps,
  active,
  onFinish,
}: {
  steps: TourStep[];
  active: boolean;
  onFinish: () => void;
}) => {
  // Only steps whose target actually exists on the page right now make the
  // tour — e.g. the "switch chapters" step only applies once a real,
  // approved membership exists to show a chapter dropdown for. Computed
  // once when the tour activates rather than re-checked every step, since
  // by then the page's data has already loaded.
  const [validSteps, setValidSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!active) return;
    const found = steps.filter(s => findTarget(s.target));
    if (found.length === 0) {
      onFinish();
      return;
    }
    setValidSteps(found);
    setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const updateRect = useCallback(() => {
    const step = validSteps[index];
    if (!step) return;
    const el = findTarget(step.target);
    if (el) setRect(measure(el));
  }, [validSteps, index]);

  useEffect(() => {
    if (!active || validSteps.length === 0) return;
    const step = validSteps[index];
    const el = findTarget(step.target);
    if (!el) {
      // Target vanished mid-tour (e.g. a resize past a breakpoint hid it)
      // — skip it rather than spotlighting nothing.
      if (index < validSteps.length - 1) setIndex(i => i + 1);
      else onFinish();
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(updateRect, 300);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, validSteps]);

  if (!active || validSteps.length === 0 || !rect) return null;

  const step = validSteps[index];
  const isLast = index === validSteps.length - 1;

  const spotlightStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    borderRadius: 10,
    boxShadow: '0 0 0 9999px rgba(15, 23, 20, 0.6)',
    outline: '2px solid #296F62',
    pointerEvents: 'none',
    transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
    zIndex: 9998,
  };

  const spaceBelow = window.innerHeight - (rect.top + rect.height);
  const placeBelow = spaceBelow > 200 || rect.top < 200;
  const cardTop = placeBelow ? rect.top + rect.height + PAD + 12 : undefined;
  const cardBottom = !placeBelow ? window.innerHeight - (rect.top - PAD - 12) : undefined;

  let cardLeft = rect.left + rect.width / 2 - CARD_WIDTH / 2;
  cardLeft = Math.max(MARGIN, Math.min(cardLeft, window.innerWidth - CARD_WIDTH - MARGIN));

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    left: cardLeft,
    top: cardTop,
    bottom: cardBottom,
    width: CARD_WIDTH,
    maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
    zIndex: 9999,
  };

  const skip = () => onFinish();
  const next = () => (isLast ? onFinish() : setIndex(i => i + 1));
  const back = () => setIndex(i => Math.max(0, i - 1));

  return (
    <div className="fixed inset-0" style={{ zIndex: 9997 }}>
      <div className="fixed inset-0" onClick={skip} />
      <div style={spotlightStyle} />
      <div style={cardStyle} className="bg-white rounded-lg shadow-lg p-4 flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold text-jade-600 uppercase tracking-wide mb-1">
            {index + 1} of {validSteps.length}
          </p>
          <h4 className="text-base font-semibold mb-1">{step.title}</h4>
          <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={skip} className="text-xs text-gray-400 hover:text-gray-600">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="px-3 py-1.5 text-sm bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors"
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
