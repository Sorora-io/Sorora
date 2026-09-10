import { Link } from 'react-router-dom';

const About = () => {
  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-3xl w-full flex flex-col gap-4">
        <section className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-xl font-semibold mb-3">Our Mission</h2>
          <div className="space-y-1.5 text-sm text-gray-700">
            <p>1. Streamline and optimize the big-little process for collegiate fraternities and sororities</p>
            <p>2. Eliminate potential biases in the matching process</p>
            <p>3. Standardize sorority practices</p>
          </div>
          <p className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">
            Sorora uses a smart matching algorithm to create the best possible Big-Little pairings
            based on mutual preferences.
          </p>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-xl font-semibold mb-4">How It Works</h2>

          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold mb-1">1. Mutual-First-Choice Matches</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                We start by identifying all mutual first-choice pairings. If a Big ranks a Little as
                their #1 choice AND that Little ranks the Big as their #1 choice, we immediately
                create that pairing. These are the strongest possible matches and are guaranteed to
                be included in the final results.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1">2. Deferred Acceptance (the NRMP Algorithm)</h3>
              <p className="text-sm leading-relaxed text-gray-600">
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
              <h3 className="text-sm font-semibold mb-1">3. Twins</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                If a Big indicates they are willing to take twins, after their first match, they will
                remain in the matching pool. They are removed after their second match.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="text-xl font-semibold mb-3">Why It Works</h2>
          <ul className="space-y-1.5 text-sm leading-relaxed list-disc list-inside text-gray-600">
            <li>Perfect matches (mutual first choices) are always preserved</li>
            <li>Deferred acceptance — the same algorithm the NRMP uses to match medical residents — guarantees a stable outcome</li>
            <li>No Big and Little who'd both rather be paired with each other are ever left unmatched with someone else</li>
            <li>Every Little gets the best Big they could get in any stable matching</li>
            <li>Twin support allows flexibility without sacrificing match quality</li>
          </ul>
        </section>
      </div>

      <div className="mt-6">
        <Link
          to="/"
          className="px-6 py-2.5 border border-jade-300 rounded-md hover:bg-jade-50 transition-colors font-medium inline-block text-sm"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default About;
