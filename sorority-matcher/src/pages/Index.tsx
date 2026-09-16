import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { getMyProfile } from '../lib/profile';
import { queryKeys } from '../lib/queryKeys';
import Button from '../components/Button';
import SceneShell, { SceneDots } from '../components/SceneShell';

// The 4-slide intro from the design canvas: three "value prop" slides
// followed by a "join or create" choice. Signed-in visitors skip the
// carousel entirely and land on a welcome slide with a shortcut to their
// dashboard.
interface Slide {
  heading: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    heading: 'Big–Little matching,\nmade simpler.',
    body: 'One place to collect preferences, keep your chapter organized, and bring pairings together.',
  },
  {
    heading: 'Everyone’s preferences.\nOne clear process.',
    body: 'Bigs and Littles submit their own rankings. Your chapter can see what’s ready and what still needs attention.',
  },
  {
    heading: 'Less coordinating.\nMore confidence.',
    body: 'Your admin reviews submissions and generates pairings from your chapter’s preferences and matching rules.',
  },
  {
    heading: 'Your chapter starts here.',
    body: 'Joining your organization, or setting it up?',
  },
];

const Heading = ({ text }: { text: string }) => (
  <h1 className="font-display text-[38px] md:text-[56px] leading-[1.05] font-medium text-[color:var(--ss-ink-1)] whitespace-pre-line">
    {text}
  </h1>
);

const Index = () => {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const { memberships } = useGroup();
  const [step, setStep] = useState(0);

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(),
    queryFn: () => getMyProfile().then(({ profile: p }) => p),
    enabled: !!user && !isGuest,
  });

  const signedIn = !!user && !isGuest;

  // Signed-in visitors get a single "welcome back" scene that points them
  // to their dashboard — the intro pitch would be a step backwards for
  // someone who already has an account.
  if (signedIn) {
    return (
      <SceneShell
        topRightLabel={null}
        footer={
          <>
            <Button size="lg" onClick={() => navigate('/dashboard')}>
              Go to my dashboard
            </Button>
            <button
              type="button"
              onClick={() => navigate('/admin/enter-bigs')}
              className="ss-link"
            >
              Or run a one-off quick match
            </button>
          </>
        }
      >
        <Heading
          text={`Welcome back${
            profile?.name ? `,\n${profile.name.split(' ')[0]}.` : '.'
          }`}
        />
        <p className="mt-6 max-w-lg text-[color:var(--ss-ink-5)] text-lg">
          {memberships.length > 0
            ? `You’re part of ${memberships.length} ${
                memberships.length === 1 ? 'chapter' : 'chapters'
              }. Everything you need is a click away.`
            : "You haven't joined a chapter yet. Let's fix that."}
        </p>
      </SceneShell>
    );
  }

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const isFirst = step === 0;

  const continueLabel = isLast ? null : 'Continue';

  return (
    <SceneShell
      topRightLabel={isFirst ? null : 'Start over'}
      onTopRight={() => setStep(0)}
      footer={
        <>
          {continueLabel && (
            <Button size="lg" onClick={() => setStep(step + 1)}>
              {continueLabel}
            </Button>
          )}
          {isLast && (
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/login?mode=signup&path=join')}
              >
                Join a chapter
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/login?mode=signup&path=create')}
              >
                Create a chapter
              </Button>
            </div>
          )}
          <SceneDots current={step} total={SLIDES.length} />
          {!isFirst && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="ss-link"
            >
              Back
            </button>
          )}
          {isFirst && (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="ss-link"
            >
              I already have an account
            </button>
          )}
        </>
      }
    >
      <Heading text={slide.heading} />
      <p className="mt-6 max-w-xl text-[color:var(--ss-ink-5)] text-lg leading-relaxed">
        {slide.body}
      </p>
    </SceneShell>
  );
};

export default Index;
