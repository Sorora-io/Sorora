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
  // Hidden from real visitors via the form's own layout — see the Edge
  // Function's README for why this field exists.
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
    const { error: sendError } = await sendContactMessage(name.trim(), email.trim(), message.trim());
    if (sendError) {
      setError(sendError);
    } else {
      setSent(true);
      setMessage('');
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-xl font-semibold mb-1">Contact Us</h2>
        <p className="text-sm text-gray-600 mb-5">
          Question, bug, or feedback — we read every message and reply by email.
        </p>

        {sent ? (
          <div className="text-center py-4">
            <p className="text-jade-700 font-medium mb-1">Message sent.</p>
            <p className="text-sm text-gray-500">Thanks for reaching out — we'll get back to you soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's up?"
                rows={5}
                className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 resize-none"
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

            {error && <p className="text-brick text-sm">{error}</p>}

            <Button type="submit" disabled={sending} fullWidth>
              {sending ? '...' : 'Send Message'}
            </Button>
          </form>
        )}
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

export default ContactUs;
