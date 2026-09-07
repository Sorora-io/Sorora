import { useState } from 'react';
import { Link } from 'react-router-dom';

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
        a: "Yes. Add or join another organization from your Profile page, then switch between them using the org switcher at the top of the sidebar.",
      },
      {
        q: 'A member wants to change roles (e.g. Big to Admin) — how do I handle that?',
        a: "Role change requests show up under \"Role change requests\" on your Approvals page, separate from new-member requests, with their own approve/reject buttons.",
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
        a: 'Sign up (or sign in, then "+ Add Organization" on your Profile), enter your chapter\'s join code, and select "Big." Your chapter admin needs to approve you before you can rank anyone.',
      },
      {
        q: 'How do I rank littles?',
        a: '"Rank Littles" appears in the sidebar once you\'re approved. Click available names in order of preference, most preferred first — you need to rank at least the minimum your admin has set.',
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
        a: 'Yes. Add or join another organization from your Profile page, then switch between them from the sidebar.',
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
        a: 'Sign up (or sign in, then "+ Add Organization" on your Profile), enter your chapter\'s join code, and select "Little." Your chapter admin needs to approve you before you can rank anyone.',
      },
      {
        q: 'How do I rank bigs?',
        a: '"Rank Bigs" appears in the sidebar once you\'re approved. Click available names in order of preference, most preferred first — you need to rank at least the minimum your admin has set.',
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
        a: 'Yes. Add or join another organization from your Profile page, then switch between them from the sidebar.',
      },
    ],
  },
];

const FAQ = () => {
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
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-4">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-3xl w-full flex flex-col gap-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-1">Frequently Asked Questions</h2>
          <p className="text-gray-500 text-sm">Pick the section that matches your role in your chapter.</p>
        </div>

        <nav className="flex justify-center gap-2 flex-wrap">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-4 py-2 text-sm font-medium border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
            >
              {s.label}
            </a>
          ))}
        </nav>

        {SECTIONS.map(section => (
          <section
            key={section.id}
            id={section.id}
            className="bg-white rounded-lg shadow-lg p-8 scroll-mt-8"
          >
            <h2 className="text-2xl font-semibold">{section.label}</h2>
            <p className="text-gray-500 text-sm mb-6">{section.intro}</p>

            <div className="flex flex-col">
              {section.items.map((item, i) => {
                const key = `${section.id}-${i}`;
                const open = openKeys.has(key);
                return (
                  <div key={key} className="border-t border-gray-200 first:border-t-0">
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      aria-expanded={open}
                      className="w-full flex items-center justify-between gap-4 py-4 text-left"
                    >
                      <span className="font-medium">{item.q}</span>
                      <span
                        className={`flex-shrink-0 text-jade-600 text-xl leading-none transition-transform ${
                          open ? 'rotate-45' : ''
                        }`}
                      >
                        +
                      </span>
                    </button>
                    {open && (
                      <p className="text-gray-700 leading-relaxed pb-4 pr-8">{item.a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default FAQ;
