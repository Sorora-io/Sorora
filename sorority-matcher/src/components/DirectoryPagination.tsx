import { useEffect, useId, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

function pageItems(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const candidates = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach(page => candidates.add(page));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach(page => candidates.add(page));
  const pages = Array.from(candidates).filter(page => page >= 1 && page <= total).sort((a, b) => a - b);
  const items: (number | string)[] = [];
  pages.forEach((page, index) => {
    const previous = pages[index - 1];
    if (previous && page - previous === 2) items.push(previous + 1);
    else if (previous && page - previous > 2) items.push(`gap-${previous}`);
    items.push(page);
  });
  return items;
}

export default function DirectoryPagination({ offset, pageSize = 50, total, itemCount, loading, noun, onPageChange }: {
  offset: number; pageSize?: number; total: number; itemCount: number;
  loading: boolean; noun: 'accounts' | 'organizations'; onPageChange: (page: number) => void;
}) {
  const id = useId();
  const [jump, setJump] = useState('');
  const [error, setError] = useState('');
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const requestedPage = Math.floor(offset / pageSize) + 1;
  const current = Math.min(requestedPage, pages);
  const updating = loading || (total > 0 && itemCount === 0) || requestedPage > pages;
  useEffect(() => { setJump(''); setError(''); }, [offset, total]);
  const show = (page: number) => { if (!updating && page >= 1 && page <= pages && page !== current) onPageChange(page); };
  return <div className="mt-5 space-y-3">
    <p role="status" aria-live="polite" className="text-sm text-[color:var(--ss-ink-4)]">
      {updating ? `Loading page ${requestedPage}…` : total === 0 ? `0 ${noun}`
        : `Showing ${itemCount === 1 ? offset + 1 : `${offset + 1}–${Math.min(offset + itemCount, total)}`} of ${total} ${total === 1 ? noun.slice(0, -1) : noun}`}
    </p>
    {total > pageSize && <nav aria-label={`${noun === 'accounts' ? 'Account' : 'Organization'} pages`} className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" className="!px-3" aria-label={`Previous page of ${noun}`} disabled={updating || current === 1} onClick={() => show(current - 1)}>
        <ChevronLeft size={16} aria-hidden="true" /><span className="hidden sm:inline">Previous</span>
      </Button>
      {pageItems(current, pages).map(page => typeof page === 'number'
        ? <Button key={page} size="sm" variant={page === current ? 'primary' : 'outline'} className="!px-3 min-w-[36px]"
          aria-label={`Page ${page}`} aria-current={page === current ? 'page' : undefined} disabled={updating} onClick={() => show(page)}>{page}</Button>
        : <span key={page} aria-hidden="true" className="px-1 text-[color:var(--ss-ink-5)]">…</span>)}
      <Button size="sm" variant="outline" className="!px-3" aria-label={`Next page of ${noun}`} disabled={updating || current === pages} onClick={() => show(current + 1)}>
        <span className="hidden sm:inline">Next</span><ChevronRight size={16} aria-hidden="true" />
      </Button>
    </nav>}
    {pages > 7 && <form className="flex flex-wrap items-center gap-2 text-sm" onSubmit={event => {
      event.preventDefault();
      const page = Number(jump);
      if (!Number.isInteger(page) || page < 1 || page > pages) { setError(`Choose a page from 1 to ${pages}.`); return; }
      setError(''); show(page);
    }}>
      <label htmlFor={id}>Go to page</label>
      <input id={id} type="number" inputMode="numeric" min={1} max={pages} step={1} value={jump} disabled={updating}
        onChange={event => { setJump(event.target.value); setError(''); }} aria-describedby={error ? `${id}-error` : undefined}
        className="w-20 rounded-lg border bg-white/70 px-2 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--ss-jade-soft)]" />
      <Button type="submit" size="sm" variant="quiet" disabled={updating || !jump.trim()}>Go</Button>
      <span className="text-[color:var(--ss-ink-5)]">of {pages}</span>
      {error && <p id={`${id}-error`} role="alert" className="w-full text-[color:var(--ss-error)]">{error}</p>}
    </form>}
  </div>;
}
