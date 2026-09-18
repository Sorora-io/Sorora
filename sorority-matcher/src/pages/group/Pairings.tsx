import PageHeader from '../../components/PageHeader';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { getPairings, PairingRow } from '../../lib/rankings';
import {
  cancelPairingReveal,
  getPairingRevealStatus,
  RevealStatus,
  schedulePairingReveal,
  sendPairingReveal,
} from '../../lib/pairings';
import { getGroupCycles, Cycle } from '../../lib/groups';
import LoadingLogo from '../../components/LoadingLogo';
import Button from '../../components/Button';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// datetime-local input needs "YYYY-MM-DDTHH:mm" in *local* time, and
// Date's ISO string is UTC — so we compute the local pieces by hand
// instead of slicing toISOString(), which would silently shift by the
// browser's offset.
const toLocalInputValue = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const Pairings = () => {
  const { membership } = useGroup();
  const group = membership?.group;

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [pairings, setPairings] = useState<PairingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [reveal, setReveal] = useState<RevealStatus | null>(null);
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealMessage, setRevealMessage] = useState('');
  const [revealError, setRevealError] = useState('');
  const [scheduleValue, setScheduleValue] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [confirmingReveal, setConfirmingReveal] = useState(false);

  // Every past cycle for this group, so admins/members can look back at
  // who matched with whom in a prior year, not just the current one.
  useEffect(() => {
    if (!group) return;
    getGroupCycles(group.id).then(({ cycles: c, error: cyclesError }) => {
      if (cyclesError) setError(cyclesError);
      setCycles(c);
      setSelectedCycleId(prev => prev ?? group.active_cycle_id ?? c[0]?.id ?? null);
    });
  }, [group]);

  const load = useCallback(async () => {
    if (!selectedCycleId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { pairings: p, error: loadError } = await getPairings(selectedCycleId);
    if (loadError) setError(loadError);
    setPairings(p);
    setLoading(false);
  }, [selectedCycleId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadReveal = useCallback(async () => {
    if (!group || !selectedCycleId) return;
    const { status } = await getPairingRevealStatus(group.id, selectedCycleId);
    setReveal(status);
    setScheduleValue(status?.scheduledAt ? toLocalInputValue(status.scheduledAt) : '');
  }, [group, selectedCycleId]);

  useEffect(() => {
    setRevealMessage('');
    setRevealError('');
    setConfirmingReveal(false);
    loadReveal();
  }, [loadReveal]);

  const byBig = new Map<string, { bigName: string | null; littles: string[] }>();
  for (const p of pairings) {
    if (!byBig.has(p.bigId)) byBig.set(p.bigId, { bigName: p.bigName, littles: [] });
    byBig.get(p.bigId)!.littles.push(p.littleName || 'Unknown');
  }

  const handleRevealNow = async () => {
    if (!group || !selectedCycleId) return;
    setRevealBusy(true);
    setRevealMessage('');
    setRevealError('');
    const { result, error: sendError } = await sendPairingReveal(group.id, selectedCycleId);
    if (sendError) {
      setRevealError(sendError);
    } else if (result) {
      setRevealMessage(
        result.sent === 0
          ? 'All Bigs have already been notified.'
          : `Emailed ${result.bigs ?? result.sent} Big${(result.bigs ?? result.sent) === 1 ? '' : 's'}.`,
      );
      await loadReveal();
    }
    setRevealBusy(false);
    setConfirmingReveal(false);
  };

  const handleSchedule = async () => {
    if (!group || !selectedCycleId || !scheduleValue) return;
    setScheduling(true);
    setRevealError('');
    setRevealMessage('');
    const when = new Date(scheduleValue);
    const { error: scheduleError } = await schedulePairingReveal(group.id, selectedCycleId, when);
    if (scheduleError) {
      setRevealError(scheduleError);
    } else {
      setRevealMessage(`Scheduled for ${formatDateTime(when.toISOString())}.`);
      await loadReveal();
    }
    setScheduling(false);
  };

  const handleCancel = async () => {
    if (!group || !selectedCycleId) return;
    setScheduling(true);
    setRevealError('');
    const { error: cancelError } = await cancelPairingReveal(group.id, selectedCycleId);
    if (cancelError) {
      setRevealError(cancelError);
    } else {
      setRevealMessage('Schedule cancelled.');
      await loadReveal();
    }
    setScheduling(false);
  };

  if (!group) return null;

  const hasPairings = pairings.length > 0;
  const scheduledInFuture = reveal?.scheduledAt && new Date(reveal.scheduledAt) > new Date() && !reveal.completedAt;
  const isViewingActiveCycle = selectedCycleId === group.active_cycle_id;

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-3xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <PageHeader className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Link
            to="/dashboard"
            className="text-sm text-[color:var(--ss-ink-4)] hover:text-[color:var(--ss-ink-1)] underline underline-offset-4"
          >
            Back to dashboard
          </Link>
        </PageHeader>

        <span className="ss-kicker">03 · After collection</span>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
              Pairings
            </h1>
            {cycles.length > 0 && selectedCycleId && (
              <p className="mt-2 ss-caption">
                {cycles.find(c => c.id === selectedCycleId)?.ended_at
                  ? `Ended ${formatDate(cycles.find(c => c.id === selectedCycleId)!.ended_at!)}`
                  : 'Currently active'}
              </p>
            )}
          </div>
          {cycles.length > 1 && (
            <select
              value={selectedCycleId ?? ''}
              onChange={e => setSelectedCycleId(e.target.value)}
              className="flex-shrink-0 text-sm bg-white/60 border border-[color:var(--ss-input-border)] rounded-pill px-4 py-2 text-[color:var(--ss-ink-3)] focus:outline-none focus:border-[color:var(--ss-jade)]"
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.id === group.active_cycle_id ? ' (active)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="mt-4 text-[color:var(--ss-error)] text-sm">{error}</p>}

        <div className="mt-8">
          {loading ? (
            <div className="flex items-center gap-2 text-[color:var(--ss-ink-5)]">
              <LoadingLogo size={20} /> Loading…
            </div>
          ) : byBig.size === 0 ? (
            <div className="ss-surface">
              <h3 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
                No pairings yet.
              </h3>
              <p className="ss-caption mt-2">Run matching from the Status page to generate this cycle's pairings.</p>
            </div>
          ) : (
            <div className="ss-surface">
              <div className="flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
                {Array.from(byBig.values()).map(({ bigName, littles }) => (
                  <div key={bigName} className="flex justify-between items-center gap-4 py-3">
                    <span className="font-medium text-[color:var(--ss-ink-2)] truncate">{bigName}</span>
                    <span className="text-[color:var(--ss-ink-4)] text-right truncate">{littles.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {hasPairings && reveal && isViewingActiveCycle && (
          <div className="mt-6 ss-surface" aria-labelledby="reveal-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="reveal-heading" className="text-base font-medium text-[color:var(--ss-ink-1)]">
                  Reveal to Bigs
                </h2>
                <p className="ss-caption mt-1">
                  {reveal.sent === 0 && !scheduledInFuture && 'Bigs haven’t been notified yet.'}
                  {reveal.sent > 0 && (
                    <>
                      Notified {reveal.sent} of {reveal.total} Big{reveal.total === 1 ? '' : 's'}
                      {reveal.lastSentAt ? `, last on ${formatDateTime(reveal.lastSentAt)}` : ''}.
                    </>
                  )}
                  {scheduledInFuture && reveal.sent === 0 && (
                    <>Scheduled for {formatDateTime(reveal.scheduledAt!)}.</>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {confirmingReveal ? (
                <div className="p-3 bg-gold-50 border border-gold-200 rounded-md">
                  <p className="text-sm text-[color:var(--ss-ink-3)] mb-3">
                    Email each Big their matched Little now? A Big who was already notified will not receive a second email.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      disabled={revealBusy}
                      onClick={() => setConfirmingReveal(false)}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" className="flex-1" onClick={handleRevealNow} disabled={revealBusy}>
                      {revealBusy ? 'Sending…' : 'Send now'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmingReveal(true)}
                  disabled={revealBusy || reveal.sent === reveal.total}
                >
                  {reveal.sent === 0 ? 'Reveal to Bigs now' : 'Send to any new Bigs'}
                </Button>
              )}

              <div className="flex flex-col gap-2 pt-3 border-t border-[color:var(--ss-surface-border)]">
                <label className="ss-label" htmlFor="reveal-schedule">
                  Or schedule a reveal
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="reveal-schedule"
                    type="datetime-local"
                    value={scheduleValue}
                    onChange={e => setScheduleValue(e.target.value)}
                    className="flex-1 min-w-[220px] p-2.5 text-sm border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                  />
                  <Button size="sm" onClick={handleSchedule} disabled={scheduling || !scheduleValue}>
                    {scheduling ? '…' : scheduledInFuture ? 'Update' : 'Schedule'}
                  </Button>
                  {scheduledInFuture && (
                    <Button size="sm" variant="ghost" onClick={handleCancel} disabled={scheduling}>
                      Cancel schedule
                    </Button>
                  )}
                </div>
                <p className="ss-caption">
                  Runs on the server — no need to keep the app open. Bigs already notified before the scheduled time won’t get a second email.
                </p>
              </div>

              {revealMessage && <p role="status" className="text-sm text-jade-700">{revealMessage}</p>}
              {revealError && <p role="alert" className="text-sm text-brick">{revealError}</p>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Pairings;
