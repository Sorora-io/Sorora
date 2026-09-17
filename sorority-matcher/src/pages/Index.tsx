import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { useMyProfile } from '../hooks/useMyProfile';
import Button from '../components/Button';
import SceneShell, { SceneDots } from '../components/SceneShell';

// The design canvas opens on a huge Georgia-serif "sorora" wordmark with
// a single quiet "Meet sorora ↓" begin button — a moment of stillness
// before the 3 value-prop slides and the join/create choice. `step === 0`
// is that opening; `step 1..4` are the four intro slides.
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

// The opening scene: nothing but the huge serif wordmark, resting on the
// glass. No kicker, no subhead. Georgia is deliberate — everything on
// this scene is one big letterform choice.
const OpeningWordmark = () => (
  <h1
    className="font-display text-[color:var(--ss-ink-1)] leading-none"
    style={{
      fontSize: 'clamp(72px, 15vw, 136px)',
      letterSpacing: '-7px',
      fontWeight: 500,
    }}
  >
    sorora
  </h1>
);

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { memberships } = useGroup();
  const [step, setStep] = useState(0);

  const { data: profile } = useMyProfile();

  const signedIn = !!user;

  // Signed-in visitors get a single "welcome back" scene that points them
  // to their dashboard — the intro pitch would be a step backwards for
  // someone who already has an account.
  if (signedIn) {
    return (
      <SceneShell
        centered
        topRightLabel={null}
        footer={
          <Button size="lg" onClick={() => navigate('/dashboard')}>
            Go to my dashboard
          </Button>
        }
      >
        <Heading
          text={`Welcome back${
            profile?.name ? `,\n${profile.name.split(' ')[0]}.` : '.'
          }`}
        />
        <p className="mt-6 max-w-lg text-[color:var(--ss-ink-5)] text-lg">
          {memberships.length > 0
            ? 'Everything you need for your chapter is a click away.'
            : "You haven't joined a chapter yet. Let's fix that."}
        </p>
      </SceneShell>
    );
  }

  // step 0 = opening wordmark; step 1..SLIDES.length = the intro slides.
  // Keeping the wordmark as step 0 (not a separate route) means "Start
  // over" can dump the visitor right back to that quiet first breath.
  const onOpening = step === 0;
  const slideIndex = step - 1;
  const slide = SLIDES[slideIndex];
  const isLastSlide = step === SLIDES.length;

  if (onOpening) {
    return (
      <SceneShell
        topRightLabel="About"
        onTopRight={() => navigate('/about')}
        footer={
          <>
            <Button size="lg" onClick={() => setStep(1)}>
              Meet sorora ↓
            </Button>
            <Button
              size="md"
              variant="outline"
              onClick={() => navigate('/login')}
            >
              I already have an account
            </Button>
          </>
        }
      >
        <OpeningWordmark />
      </SceneShell>
    );
  }

  return (
    <SceneShell
      topRightLabel="Start over"
      onTopRight={() => setStep(0)}
      footer={
        <>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              variant="outline"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={16} /> Back
            </Button>
            {!isLastSlide && (
              <Button size="lg" onClick={() => setStep(step + 1)}>
                Continue <ArrowRight size={16} />
              </Button>
            )}
            {isLastSlide && (
              <>
                <Button
                  size="lg"
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
              </>
            )}
          </div>
          <SceneDots current={slideIndex} total={SLIDES.length} />
        </>
      }
    >
      <div className="ss-kicker">{`${step} / ${SLIDES.length}`}</div>
      <Heading text={slide.heading} />
      <p className="mt-6 max-w-xl text-[color:var(--ss-ink-5)] text-lg leading-relaxed">
        {slide.body}
      </p>
    </SceneShell>
  );
};

export default Index;
