import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';

// Global site footer — rendered after every route in App.tsx so scene
// pages keep their full-viewport panel and it sits just below the fold,
// while content pages that scroll (Dashboard, About, FAQ) land it at the
// natural bottom. Instagram links out; the rest are in-app routes.
const Footer = () => {
  return (
    <footer className="w-full border-t border-[color:var(--ss-surface-border)] mt-16 py-6">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8 text-sm text-[color:var(--ss-ink-5)]">
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-4 sm:flex sm:justify-between">
          <Link to="/" className="font-display italic text-lg text-[color:var(--ss-ink-3)] hover:text-[color:var(--ss-ink-1)] transition-colors">
            sorora
          </Link>
          <nav aria-label="Site" className="col-span-2 row-start-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link to="/about" className="hover:text-[color:var(--ss-ink-2)] underline-offset-4 hover:underline">About</Link>
            <Link to="/faq" className="hover:text-[color:var(--ss-ink-2)] underline-offset-4 hover:underline">FAQ</Link>
            <Link to="/contact" className="hover:text-[color:var(--ss-ink-2)] underline-offset-4 hover:underline">Contact us</Link>
          </nav>
          <a
            href="https://www.instagram.com/sorora.app/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Sorora on Instagram"
            className="inline-flex items-center gap-2 hover:text-[color:var(--ss-ink-2)] transition-colors"
          >
            <Instagram size={18} aria-hidden="true" />
            <span>@sorora.app</span>
          </a>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
