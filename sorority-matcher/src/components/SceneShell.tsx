import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface SceneShellProps {
  children: ReactNode;
  /** Where the "sorora" wordmark should link. Defaults to /. */
  markTo?: string;
  /** Text for the top-right action. Set to null to hide it entirely. */
  topRightLabel?: string | null;
  onTopRight?: () => void;
  /** Rendered under the Continue button — dot indicators and Back. */
  footer?: ReactNode;
  /** Optional wider max-width for content-heavy pages (dashboard, FAQ). */
  wide?: boolean;
  centered?: boolean;
}

// Every screen in the sorora-story canvas shares the same frame: a soft
// frosted panel centered on the mint background, "sorora" wordmark
// top-left, "Start over" (or similar) top-right, content in the middle,
// and a Continue-plus-Back footer. This component owns that frame so the
// individual scenes stay short and readable.
const SceneShell = ({
  children,
  markTo = '/',
  topRightLabel = 'Start over',
  onTopRight,
  footer,
  wide = false,
  centered = false,
}: SceneShellProps) => {
  const navigate = useNavigate();
  const handleTopRight = onTopRight ?? (() => navigate('/'));

  return (
    <div className={`min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8 ${centered ? 'justify-center' : ''}`}>
      <section
        className={`ss-frost w-full ${
          wide ? 'max-w-4xl' : 'max-w-2xl'
        } rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-14 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col`}
      >
        <header className="flex items-center justify-between mb-8">
          <Link
            to={markTo}
            className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]"
          >
            sorora
          </Link>
          {topRightLabel !== null && (
            <button
              type="button"
              onClick={handleTopRight}
              className="text-sm text-[color:var(--ss-ink-4)] hover:text-[color:var(--ss-ink-1)] underline underline-offset-4"
            >
              {topRightLabel}
            </button>
          )}
        </header>

        <div className="flex-1 flex flex-col items-center text-center">
          {children}
        </div>

        {footer && (
          <div className="mt-10 flex flex-col items-center gap-4">{footer}</div>
        )}
      </section>
    </div>
  );
};

export default SceneShell;

// Utility: dot indicator row shown under Continue on carousel + tour
// scenes. Renders `total` dots with the one at index `current` filled.
interface DotsProps {
  current: number;
  total: number;
}
export const SceneDots = ({ current, total }: DotsProps) => (
  <div className="ss-dots" role="presentation">
    {Array.from({ length: total }).map((_, i) => (
      <span key={i} className={i === current ? 'is-active' : ''} />
    ))}
  </div>
);
