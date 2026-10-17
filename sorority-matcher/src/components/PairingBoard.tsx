import { useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { PairingEditorData } from '../lib/pairingChanges';
import Button from './Button';

// Dragging and the keyboard/touch buttons prepare the same proposal. Neither
// path writes assignments; the parent requires a reason and confirmation.
export default function PairingBoard({ draft, littleId, toBigId, swapId, disabled, onMove, onSwap }: {
  draft: PairingEditorData; littleId: string; toBigId: string; swapId: string; disabled: boolean;
  onMove: (littleId: string, bigId: string) => void; onSwap: (littleId: string) => void;
}) {
  const [pool, setPool] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [destinationSearch, setDestinationSearch] = useState('');
  const selectedBigs = new Set(pool.filter(id => id.startsWith('big:')).map(id => id.slice(4)));
  for (const pair of draft.pairings) if (pool.includes('little:' + pair.littleId)) selectedBigs.add(pair.bigId);
  const [dragging, setDragging] = useState('');
  const [over, setOver] = useState('');
  const pointerStart = useRef<{id: string; x: number; y: number} | null>(null);
  const [pointer, setPointer] = useState<{x: number; y: number} | null>(null);
  const clearDrag = () => { pointerStart.current = null; setPointer(null); setDragging(''); setOver(''); };
  const source = draft.pairings.find(p => p.littleId === littleId);
  const destination = draft.bigs.find(b => b.id === toBigId);
  const occupants = draft.pairings.filter(p => p.bigId === toBigId);
  const full = !!destination && occupants.length >= destination.capacity;
  const ready = !!source && !!destination && (!full || !!swapId);
  const cards: {id: string; name: string; capacity: number | null}[] = [...draft.bigs];
  // Preserve visibility of matches whose Big has since left the chapter.
  for (const pair of draft.pairings) if (!cards.some(b => b.id === pair.bigId)) {
    cards.push({ id: pair.bigId, name: pair.bigName || 'Former member', capacity: null });
  }
  if (source) selectedBigs.add(source.bigId);
  if (toBigId) selectedBigs.add(toBigId);
  const visibleCards = showAll ? cards : cards.filter(big => selectedBigs.has(big.id));
  const results = [
    ...cards.map(big => ({id: 'big:' + big.id, name: big.name, role: 'Big'})),
    ...draft.pairings.map(pair => ({id: 'little:' + pair.littleId, name: pair.littleName || 'Unnamed Little', role: 'Little'})),
  ].filter(person => search.trim() && person.name.toLowerCase().includes(search.toLowerCase())).slice(0, 10);
  const displayed = draft.pairings.map(p => ready && p.littleId === littleId
    ? {...p, bigId: toBigId} : ready && p.littleId === swapId
      ? {...p, bigId: source!.bigId} : p);
  const announcement = source && destination
    ? full && !swapId ? `${destination.name} is at capacity. Choose a Little below to exchange with ${source.littleName}.`
      : `Proposed ${swapId ? 'swap' : 'move'} ready. Add a reason and review before saving.`
    : source ? `Choose a destination for ${source.littleName}, or drag their card onto another Big.`
      : 'Drag a Little onto another Big. You can also use the Move buttons.';
  return <div>
    <div className="rounded-xl border border-[color:var(--ss-surface-border)] p-4 mb-4">
      <h3 className="font-medium">Choose your editing pool</h3>
      <p className="ss-caption mt-1">Find Littles to change, their current Bigs, or a destination Big. Only relevant Bigs appear below, with all their current Littles.</p>
      <label className="block ss-label mt-3">Search Bigs and Littles
        <input className="ss-input mt-1 w-full" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a name…" disabled={disabled} />
      </label>
      {search.trim() && <div className="mt-2 space-y-1 max-h-60 overflow-auto">
        {results.length === 0 && <p className="ss-caption">No names found.</p>}
        {results.map(person => <Button key={person.id} variant={pool.includes(person.id) ? 'quiet' : 'outline'} size="sm" className="mr-2 mb-2" aria-pressed={pool.includes(person.id)} disabled={disabled}
          onClick={() => setPool(previous => previous.includes(person.id) ? previous.filter(id => id !== person.id) : [...previous, person.id])}>
          {pool.includes(person.id) ? 'Remove' : 'Add'} {person.name} · {person.role}
        </Button>)}
        <p className="ss-caption">Showing up to 10 matches. Refine your search to find someone else.</p>
      </div>}
      <div className="flex flex-wrap gap-2 mt-3">
        {pool.map(id => { const person = id.startsWith('big:') ? cards.find(b => b.id === id.slice(4)) : draft.pairings.find(p => p.littleId === id.slice(7));
          const name = person && ('name' in person ? person.name : person.littleName);
          return <Button key={id} variant="quiet" size="sm" disabled={disabled} onClick={() => setPool(previous => previous.filter(item => item !== id))}>Remove {name}</Button>;
        })}
        <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show editing pool' : 'Show everyone'}</Button>
      </div>
    </div>
    {visibleCards.length === 0 && <p className="ss-caption mb-4">Search and add names above to start. You can add more Bigs at any time.</p>}
    {source && <div className="mb-4 rounded-xl border p-4">
      <label className="ss-label block">Move {source.littleName} to…
        <input className="ss-input w-full mt-1" value={destinationSearch} onChange={e => setDestinationSearch(e.target.value)} placeholder="Search destination Big" disabled={disabled} />
      </label>
      {cards.filter(b => b.id !== source.bigId && b.capacity !== null && b.name.toLowerCase().includes(destinationSearch.toLowerCase())).slice(0,10).map(big => <Button key={big.id} variant="outline" size="sm" className="mt-2 mr-2" disabled={disabled} onClick={() => { setPool(previous => [...new Set([...previous, 'big:' + big.id])]); onMove(littleId,big.id); }}>
        {draft.pairings.filter(p => p.bigId === big.id).length >= (big.capacity ?? 0) ? 'Exchange with' : 'Move to'} {big.name}{draft.pairings.filter(p => p.bigId === big.id).length >= (big.capacity ?? 0) ? '…' : ''}
      </Button>)}
    </div>}
    <p id="pairing-board-help" className="ss-caption mb-4">Drag a Little onto another Big, or use Move. Changes stay as a preview until you confirm.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-describedby="pairing-board-help">
      {visibleCards.map(big => {
        const current = draft.pairings.filter(p => p.bigId === big.id);
        const members = displayed.filter(p => p.bigId === big.id);
        const dragged = draft.pairings.find(p => p.littleId === dragging);
        const canDrop = !disabled && big.capacity !== null && !!dragged && dragged.bigId !== big.id;
        return <article key={big.id} aria-label={`Big ${big.name}`} data-testid={`big-card-${big.id}`} data-big-id={big.id}
          className={`rounded-2xl border p-4 transition-colors ${over === big.id && canDrop ? 'border-[color:var(--ss-jade)] bg-[color:var(--ss-pill-bg)] ring-2 ring-[color:var(--ss-jade)]' : toBigId === big.id ? 'border-[color:var(--ss-jade)] bg-white/70' : 'border-[color:var(--ss-surface-border)] bg-white/40'}`}
          onDragOver={event => { if (canDrop) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOver(big.id); } }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(''); }}
          onDrop={event => { event.preventDefault(); if (canDrop) onMove(dragging, big.id); setOver(''); setDragging(''); }}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-medium">{big.name}</h3>
            <span className="text-xs text-[color:var(--ss-ink-5)]">{big.capacity === null ? 'No longer an approved Big' : `${members.length} / ${big.capacity} Littles${members.length >= big.capacity ? ' · At capacity' : ''}`}</span>
          </div>
          <div className="space-y-2 min-h-[72px]">
            {members.map(pair => {
              const changed = ready && (pair.littleId === littleId || pair.littleId === swapId);
              return <div key={pair.littleId} draggable={!disabled} data-testid={`little-card-${pair.littleId}`}
                onDragStart={event => { if (disabled) { event.preventDefault(); return; } setDragging(pair.littleId); event.dataTransfer.setData('text/plain', pair.littleId); event.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragging(''); setOver(''); }}
                className={`flex items-center gap-2 rounded-xl border bg-white p-3 ${!disabled ? 'cursor-grab active:cursor-grabbing' : ''} ${pair.littleId === littleId ? 'border-[color:var(--ss-jade)]' : 'border-[color:var(--ss-surface-border)]'}`}>
                <Button variant="ghost" size="sm" className="!p-0 !min-h-[36px] w-6 shrink-0 touch-none !cursor-grab" aria-label={`Drag ${pair.littleName}`} disabled={disabled}
                  onDragStart={event => event.preventDefault()}
                  onPointerDown={event => {
                    if (disabled || event.button !== 0) return;
                    event.preventDefault();
                    pointerStart.current = {id: pair.littleId, x: event.clientX, y: event.clientY};
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={event => {
                    const start = pointerStart.current;
                    if (!start || disabled || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
                    setDragging(start.id); setPointer({x: event.clientX, y: event.clientY});
                    setOver(document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-big-id]')?.getAttribute('data-big-id') || '');
                  }}
                  onPointerUp={event => {
                    const start = pointerStart.current;
                    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-big-id]')?.getAttribute('data-big-id');
                    const original = draft.pairings.find(p => p.littleId === start?.id);
                    if (!disabled && start && original && target && target !== original.bigId && draft.bigs.some(b => b.id === target) && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 5) onMove(start.id, target);
                    clearDrag();
                  }}
                  onPointerCancel={clearDrag} onLostPointerCapture={clearDrag}>
                  <GripVertical aria-hidden="true" size={16} />
                </Button>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium break-words">{pair.littleName}</p>{changed && <p className="text-xs text-[color:var(--ss-jade)]">Proposed change</p>}</div>
                <Button variant="quiet" size="sm" className="!px-3" disabled={disabled} aria-label={`Move ${pair.littleName}`} aria-pressed={pair.littleId === littleId} onClick={() => onMove(pair.littleId, '')}>Move to…</Button>
              </div>;
            })}
            {members.length === 0 && <p className="rounded-xl border border-dashed border-[color:var(--ss-input-border)] p-4 ss-caption">{big.capacity === null ? 'No Littles' : 'Drop a Little here'}</p>}
          </div>
          {source && source.bigId !== big.id && big.capacity !== null && <Button variant="outline" size="sm" className="mt-3 w-full !whitespace-normal" disabled={disabled} onClick={() => onMove(littleId, big.id)}>
            {current.length >= big.capacity ? `Exchange with ${big.name}…` : `Move to ${big.name}`}
          </Button>}
        </article>;
      })}
    </div>
    {pointer && dragging && <div aria-hidden="true" className="fixed z-50 pointer-events-none rounded-xl bg-white border border-[color:var(--ss-jade)] px-4 py-3 shadow-lg" style={{left:pointer.x + 12, top:pointer.y + 12}}>{draft.pairings.find(p => p.littleId === dragging)?.littleName}</div>}
    <p role="status" className="ss-caption mt-4" aria-live="polite">{announcement}</p>
    {source && destination && occupants.length > 0 && <div className="mt-3 rounded-xl border border-[color:var(--ss-surface-border)] p-4">
      <h3 className="text-sm font-medium">{full ? `Choose a Little to move to ${source.bigName} in exchange` : 'Or exchange Littles instead'}</h3>
      <div className="flex flex-wrap gap-2 mt-3">
        {!full && <Button variant={swapId ? 'outline' : 'quiet'} size="sm" aria-pressed={!swapId} disabled={disabled} onClick={() => onSwap('')}>Move only</Button>}
        {occupants.map(p => <Button key={p.littleId} variant={swapId === p.littleId ? 'quiet' : 'outline'} size="sm" aria-pressed={swapId === p.littleId} disabled={disabled} onClick={() => onSwap(p.littleId)}>Exchange with {p.littleName}</Button>)}
      </div>
    </div>}
  </div>;
}
