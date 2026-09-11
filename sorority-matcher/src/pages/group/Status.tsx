import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import { getSubmissionStatus, runMatching, SubmissionStatusRow } from '../../lib/rankings';
import { sendRankingReminders } from '../../lib/reminders';
import { queryKeys } from '../../lib/queryKeys';
import LoadingLogo from '../../components/LoadingLogo';
import Button from '../../components/Button';

const Status = () => {
  const navigate = useNavigate();
  const { membership } = useGroup();
  const group = membership?.group;

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [reminding, setReminding] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderError, setReminderError] = useState('');

  const cycleId = group?.active_cycle_id ?? null;

  const {
    data: rows = [] as SubmissionStatusRow[],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.submissionStatus(cycleId ?? ''),
    queryFn: () => getSubmissionStatus(group!.id, cycleId).then(({ rows: r, error: loadError }) => {
      if (loadError) throw new Error(loadError);
      return r;
    }),
    enabled: !!group && !!cycleId,
  });
  const error = runError || (queryError ? (queryError as Error).message : '');

  const bigs = rows.filter(r => r.role === 'big');
  const littles = rows.filter(r => r.role === 'little');
  const allSubmitted = rows.length > 0 && rows.every(r => r.submitted);

  const handleRun = async () => {
    if (!group || !cycleId) return;
    setRunning(true);
    setRunError('');
    const { error: runFailure } = await runMatching(group.id, cycleId);
    if (runFailure) {
      setRunError(runFailure);
      setRunning(false);
      return;
    }
    navigate('/group/pairings');
  };

  const handleRemind = async () => {
    if (!group) return;
    setReminding(true);
    setReminderError('');
    setReminderMessage('');
    const { result, error: sendError } = await sendRankingReminders(group.id);
    if (sendError) {
      setReminderError(sendError);
    } else if (result) {
      setReminderMessage(
        result.total === 0
          ? 'Everyone has already submitted.'
          : `Sent ${result.sent} of ${result.total} reminder ${result.total === 1 ? 'email' : 'emails'}.`
      );
    }
    setReminding(false);
  };

  if (!group) return null;

  const renderList = (label: string, list: SubmissionStatusRow[]) => (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        {label} ({list.filter(r => r.submitted).length}/{list.length} submitted)
      </h3>
      <div className="flex flex-col gap-1">
        {list.map(r => (
          <div key={r.userId} className="flex items-center justify-between px-3 py-2 border border-gray-100 rounded-md">
            <span>{r.name || r.email}</span>
            <span className={r.submitted ? 'text-jade-700 text-sm' : 'text-gray-400 text-sm'}>
              {r.submitted ? 'Submitted' : 'Waiting'}
            </span>
          </div>
        ))}
        {list.length === 0 && <p className="text-gray-400 text-sm">No one approved yet.</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-2xl w-full">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-4">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-2xl font-semibold mb-6">Submission Status</h2>

        {!cycleId ? (
          <p className="text-gray-500 text-sm">
            No active cycle yet — start one from Group Settings before collecting rankings.
          </p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-gray-500"><LoadingLogo size={20} /> Loading...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {renderList('Bigs', bigs)}
            {renderList('Littles', littles)}
          </div>
        )}

        {error && <p className="text-brick text-sm mb-4">{error}</p>}

        {cycleId && !allSubmitted && !loading && (
          <div className="mb-4">
            <p className="text-gold-700 text-sm mb-2">
              Not everyone has submitted their ranking yet — you can still run matching, but unsubmitted
              members will be treated as having no preferences.
            </p>
            <Button variant="outline" size="sm" onClick={handleRemind} disabled={reminding}>
              {reminding ? 'Sending...' : 'Send reminder emails'}
            </Button>
            {reminderMessage && <p className="text-jade-700 text-sm mt-2">{reminderMessage}</p>}
            {reminderError && <p className="text-brick text-sm mt-2">{reminderError}</p>}
          </div>
        )}

        {cycleId && (
          <Button fullWidth onClick={handleRun} disabled={running || loading || rows.length === 0}>
            {running ? 'Running...' : 'Run Matching'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Status;
