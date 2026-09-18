import PageHeader from '../components/PageHeader';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { sendContactMessage } from '../lib/contact';
import Button from '../components/Button';

const ContactUs = () => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please fill in your name, email, and message.');
      return;
    }
    setSending(true);
    setError('');
    const { error: sendError } = await sendContactMessage(name.trim(), email.trim(), message.trim(), website);
    if (sendError) {
      setError(sendError);
    } else {
      setSent(true);
      setMessage('');
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-6 py-10">
      <PageHeader className="w-full max-w-xl mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="font-display text-xl font-semibold text-[color:var(--ss-ink-1)] tracking-wide"
        >
          sorora
        </Link>
        <Link
          to="/"
          className="text-sm text-[color:var(--ss-ink-5)] hover:text-[color:var(--ss-ink-2)] underline underline-offset-4"
        >
          Back to home
        </Link>
      </PageHeader>

      <section className="ss-frost w-full max-w-xl rounded-[24px] px-6 py-10 md:px-10 md:py-12 shadow-card">
        <div className="ss-kicker">Contact</div>
        <h1 className="font-display text-[32px] md:text-[38px] leading-[1.1] font-semibold text-[color:var(--ss-ink-1)] mb-2">
          Question, bug, or feedback?
        </h1>
        <p className="text-[color:var(--ss-ink-5)] mb-8">
          We read every message and reply by email.
        </p>

        {sent ? (
          <div className="ss-surface text-center">
            <h2 className="font-display text-2xl text-[color:var(--ss-ink-1)] mb-1">Message sent.</h2>
            <p className="text-sm text-[color:var(--ss-ink-5)]">
              Thanks for reaching out — we'll get back to you soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="ss-label" htmlFor="contact-name">Name</label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="ss-input"
              />
            </div>
            <div>
              <label className="ss-label" htmlFor="contact-email">Email</label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="ss-input"
              />
            </div>
            <div>
              <label className="ss-label" htmlFor="contact-message">Message</label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's up?"
                rows={5}
                className="ss-input resize-none"
              />
            </div>

            {/* Honeypot — real users never see this. */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />

            {error && <p className="text-[color:var(--ss-error)] text-sm">{error}</p>}

            <Button type="submit" disabled={sending} fullWidth>
              {sending ? '...' : 'Send message'}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
};

export default ContactUs;
