import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { RankingExport } from '../lib/rankingExport';
import Button from './Button';

type Member = RankingExport['members'][number];
export default function MemberRankingPicker({ members, value, onChange }: {
  members: Member[]; value: string; onChange: (id: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const selected = members.find(member => member.userId === value);
  const role = (member: Member) => member.role === 'big' ? 'Big' : 'Little';
  const label = (member: Member) => `${member.name || member.email} · ${role(member)} · ${member.email}`;
  const filtered = members.filter(member => label(member).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const activeIndex = Math.min(active, Math.max(0, filtered.length - 1));
  const close = (restoreFocus = false) => { setOpen(false); if (restoreFocus) trigger.current?.focus(); };
  const choose = (member: Member) => { onChange(member.userId); close(true); };
  const show = (last = false) => { setSearch(''); setActive(last ? members.length - 1 : 0); setOpen(true); };
  useEffect(() => {
    if (!open) return;
    searchInput.current?.focus();
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex, id, search]);
  return <div ref={root} className="relative w-full max-w-[22rem]" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <label htmlFor={`${id}-trigger`} className="block text-sm font-medium mb-2">Member</label>
    <Button ref={trigger} id={`${id}-trigger`} variant="outline" className="w-full sm:w-auto max-w-full !justify-between !gap-2 !rounded-control !px-3" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`}
      title={selected ? label(selected) : 'Choose a member'} onClick={() => open ? close() : show()}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(event.key === 'ArrowUp'); }
        if (event.key === 'Escape') close();
      }}>
      <span className="truncate min-w-0">{selected ? label(selected) : 'Choose a member'}</span>
      <ChevronDown size={16} className="shrink-0" aria-hidden="true" />
    </Button>
    {open && <div className="absolute z-20 left-0 mt-2 w-full rounded-xl border border-[color:var(--ss-surface-border)] bg-white p-2 shadow-lg">
      <div className="flex items-center gap-2 px-1">
        <Search size={16} className="shrink-0" aria-hidden="true" />
        <input ref={searchInput} type="search" role="combobox" aria-label="Search members" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
          aria-activedescendant={filtered.length ? `${id}-option-${activeIndex}` : undefined}
          value={search} autoComplete="off" placeholder="Search name, email or role" className="min-w-0 w-full rounded-control p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--ss-jade-soft)]"
          onChange={event => { setSearch(event.target.value); setActive(0); }}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              setActive(event.key === 'Home' ? 0 : event.key === 'End' ? Math.max(0, filtered.length - 1)
                : event.key === 'ArrowDown' ? Math.min(activeIndex + 1, filtered.length - 1) : Math.max(0, activeIndex - 1));
            }
            if (event.key === 'Enter') { event.preventDefault(); if (filtered[activeIndex]) choose(filtered[activeIndex]); }
          }} />
        {search && <Button size="sm" variant="ghost" className="!px-2" onClick={() => { setSearch(''); setActive(0); searchInput.current?.focus(); }}>Clear search</Button>}
      </div>
      <div id={`${id}-list`} role="listbox" aria-label="Members" className="mt-1 max-h-60 overflow-y-auto overscroll-contain">
        {filtered.map((member, index) => <Button key={member.userId} id={`${id}-option-${index}`} role="option" aria-selected={member.userId === value} tabIndex={-1} variant="ghost" fullWidth
          className={`!justify-start !rounded-control !px-3 !py-2 !whitespace-normal text-left ${index === activeIndex ? '!bg-[color:var(--ss-button-hover)]' : ''}`}
          onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(member)}>
          <span className="min-w-0 break-words [overflow-wrap:anywhere]"><span className="block font-medium">{member.name || member.email} · {role(member)}</span><span className="block text-xs">{member.email}</span></span>
        </Button>)}
      </div>
      {!filtered.length && <p role="status" className="ss-caption px-3 py-2">No members found. Try another name, email or role.</p>}
    </div>}
  </div>;
}
