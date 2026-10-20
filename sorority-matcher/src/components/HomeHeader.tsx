import { useNavigate } from 'react-router-dom';
import Button from './Button';
import PageHeader from './PageHeader';

export default function HomeHeader() {
  const navigate = useNavigate();
  return <div className="w-full border-b border-[color:var(--ss-surface-border)] bg-white/40">
    <PageHeader role="banner" aria-label="Main header" className="mx-auto w-full max-w-6xl px-5 py-5 md:px-8">
      <Button variant="ghost" className="ss-wordmark !p-0 !min-h-0 !text-2xl font-display italic !font-medium !text-[color:var(--ss-ink-1)]" onClick={() => navigate('/')} aria-label="Sorora home">sorora</Button>
    </PageHeader>
  </div>;
}
