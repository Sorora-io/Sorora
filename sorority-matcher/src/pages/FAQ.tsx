import PageHeader from '../components/PageHeader';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface QA {
  q: string;
  a: string;
}

interface FaqSection {
  id: string;
  label: string;
  intro: string;
  items: QA[];
}

const SECTIONS: FaqSection[] = [
  {
    id: 'admins',
    label: 'For Admins',
    intro: "Running your chapter's roster, approvals, and matching.",
    items: [
      {
        q: 'How do I create my chapter on Sorora?',
        a: "When you sign up, choose \"Create a group,\" then enter your chapter's name and school. You'll automatically become that chapter's admin and get a join code to share with your members.",
      },
      {
        q: 'How do members join my chapter?',
        a: 'Share your join code or join link — both are on the Approvals page. New members request to join with a role (Admin, Big, or Little), and their request sits in your Approvals list until you approve or reject it.',
      },
      {
        q: 'How do I set minimum ranking requirements?',
        a: "Group Settings has a \"Minimum Bigs a Little must rank\" and \"Minimum Littles a Big must rank\" field. Members can't submit their ranking until they've ranked at least that many people.",
      },
      {
        q: 'How does matching actually work?',
        a: "We first lock in every mutual first-choice pair, then run deferred acceptance — the same stable-matching algorithm the National Resident Matching Program uses — for everyone else. See the About page for the full breakdown.",
      },
      {
        q: 'Can bigs take twins (two littles)?',
        a: "Yes. Bigs can check \"I'm willing to take two Littles\" on their ranking page. A big who opts in stays in the matching pool for a second match after their first.",
      },
      {
        q: "Can I rename my chapter or update its school?",
        a: "Yes — Group Settings has a \"Sorority group name\" and \"School\" section at the top, saved independently from the ranking requirements below it.",
      },
      {
        q: 'Can I admin more than one chapter?',
        a: 'Sorora currently supports one chapter per account.',
      },
      {
        q: 'A member wants to change roles (e.g. Big to Admin) — how do I handle that?',
        a: "Role change requests show up under \"Role change requests\" on your Approvals page, separate from new-member requests, with their own approve/reject buttons.",
      },
      {
        q: "How do I hand off my chapter to someone else (graduating, stepping down, etc.)?",
        a: "Every chapter has one owner, separate from its (possibly several) admins — admins can approve members and edit settings day to day, but only the owner can transfer ownership. If you're the owner, Group Settings has an \"Ownership\" section where you can pick any other approved admin and transfer it to them, with a confirmation step before it goes through. You'll remain an admin afterward, just no longer the owner. If there's no other admin yet, approve one first — ownership can only transfer to an existing admin of your chapter.",
      },
    ],
  },
  {
    id: 'bigs',
    label: 'For Bigs',
    intro: 'Joining your chapter and ranking your littles.',
    items: [
      {
        q: 'How do I join my chapter?',
        a: 'Sign up and choose "Join a chapter", enter your chapter\'s join code, and select "Big." Your chapter admin needs to approve you before you can rank anyone.',
      },
      {
        q: 'How do I rank littles?',
        a: 'Open the Rankings tab on your dashboard after your membership is approved. Rank available members in order of preference, most preferred first, and meet the minimum set by your admin.',
      },
      {
        q: "Can I take twins?",
        a: 'Check "I\'m willing to take two Littles (twins)" before saving your ranking. If you opt in, you may be matched with a second little.',
      },
      {
        q: 'When do I find out who my little is?',
        a: "Pairing results currently live on your chapter admin's Pairings page, not on your own account — ask your admin once they've run matching.",
      },
      {
        q: 'Can I be in more than one chapter?',
        a: 'Sorora currently supports one chapter per account.',
      },
      {
        q: 'How do I request to become an Admin or Little?',
        a: 'On your Profile page, "Request a role change" lets you pick a new role and send the request to your chapter admin.',
      },
    ],
  },
  {
    id: 'littles',
    label: 'For Littles',
    intro: 'Joining your chapter and ranking your bigs.',
    items: [
      {
        q: 'How do I join my chapter?',
        a: 'Sign up and choose "Join a chapter", enter your chapter\'s join code, and select "Little." Your chapter admin needs to approve you before you can rank anyone.',
      },
      {
        q: 'How do I rank bigs?',
        a: 'Open the Rankings tab on your dashboard after your membership is approved. Rank available members in order of preference, most preferred first, and meet the minimum set by your admin.',
      },
      {
        q: "I'm still waiting on approval — what do I do?",
        a: 'You\'ll see a "Waiting on approval" screen with a "Check again" button. If it\'s been a while, reach out to your chapter admin directly.',
      },
      {
        q: 'When will I know who my big is?',
        a: "Pairing results currently live on your chapter admin's Pairings page, not on your own account — ask your admin once they've run matching.",
      },
      {
        q: 'Can I be in more than one chapter?',
        a: 'Sorora currently supports one chapter per account.',
      },
    ],
  },
];

const FAQ = () => {
  const { user } = useAuth();
  const backTo = user ? "/dashboard" : "/";
  const backLabel = user ? "Back to dashboard" : "Back to home";
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set([`${SECTIONS[0].id}-0`]));

  const toggle = (key: string) => {
    setOpenKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-3xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <PageHeader className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Link
            to={backTo}
            className="inline-flex items-center justify-center rounded-pill border border-[color:var(--ss-jade-line)] px-5 py-2 text-sm text-[color:var(--ss-ink-2)] hover:bg-white/60"
          >
            {backLabel}
          </Link>
        </PageHeader>

        <div className="text-center mb-8">
          <h1 className="font-display text-[38px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
            Frequently Asked Questions
          </h1>
          <p className="mt-3 ss-caption max-w-lg mx-auto">
            Pick the section that matches your role in your chapter.
          </p>
        </div>

        <nav className="flex justify-center gap-3 flex-wrap mb-8">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex items-center justify-center rounded-pill border border-[color:var(--ss-jade-line)] bg-white/60 px-6 py-2.5 text-sm font-medium text-[color:var(--ss-ink-2)] transition-colors hover:bg-[color:var(--ss-jade-deep)] hover:text-white hover:border-transparent"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-4">
          {SECTIONS.map(section => (
            <section key={section.id} id={section.id} className="ss-surface scroll-mt-8">
              <h2 className="font-display text-[24px] font-medium text-[color:var(--ss-ink-1)]">
                {section.label}
              </h2>
              <p className="ss-caption mb-4">{section.intro}</p>

              <div className="flex flex-col">
                {section.items.map((item, i) => {
                  const key = `${section.id}-${i}`;
                  const open = openKeys.has(key);
                  return (
                    <div
                      key={key}
                      className="border-t border-[color:var(--ss-surface-border)] first:border-t-0"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-expanded={open}
                        className="w-full flex items-center justify-between gap-4 py-4 text-left"
                      >
                        <span className="font-medium text-[color:var(--ss-ink-2)]">{item.q}</span>
                        <span
                          className={`flex-shrink-0 text-[color:var(--ss-jade)] text-xl leading-none transition-transform ${
                            open ? 'rotate-45' : ''
                          }`}
                        >
                          +
                        </span>
                      </button>
                      {open && (
                        <p className="text-[color:var(--ss-ink-4)] leading-relaxed pb-4 pr-8">
                          {item.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link to={backTo} className="ss-link inline-block mb-4">{backLabel}</Link>
          <p className="ss-caption">
            Still have questions?{' '}
            <Link to="/contact" className="underline underline-offset-4 text-[color:var(--ss-ink-2)] font-medium">
              Contact us
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
};

export default FAQ;
