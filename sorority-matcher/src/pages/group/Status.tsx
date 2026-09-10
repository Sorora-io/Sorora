import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { getSubmissionStatus, runMatching, SubmissionStatusRow } from '../../lib/rankings';
import LoadingLogo from '../../components/LoadingLogo';

const Status = () => {
  const navigate = useNavigate();
  const { membership } = useGroup();
  const group = membership?.group;

  const [rows, setRows] = useState<SubmissionStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    const { rows: r, error: loadError } = await getSubmissionStatus(group.id);
    if (loadError) setError(loadError);
    setRows(r);
    setLoading(false);
  }, [group]);

  useEffect(() => {
    load();
  }, [load]);

  const bigs = rows.filter(r => r.role === 'big');
  const littles = rows.filter(r => r.role === 'little');
  const allSubmitted = rows.length > 0 && rows.every(r => r.submitted);

  const handleRun = async () => {
    if (!group) return;
    setRunning(true);
    setError('');
    const { error: runError } = await runMatching(group.id);
    if (runError) {
      setError(runError);
      setRunning(false);
      return;
    }
    navigate('/group/pairings');
  };

  if (!group) return null;

  const renderList = (label: string, list: SubmissionStatusRow[]) => (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
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

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-2xl font-semibold mb-6">Submission Status</h2>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500"><LoadingLogo size={20} /> Loading...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {renderList('Bigs', bigs)}
            {renderList('Littles', littles)}
          </div>
        )}

        {error && <p className="text-brick text-sm mb-4">{error}</p>}

        {!allSubmitted && !loading && (
          <p className="text-gold-700 text-sm mb-4">
            Not everyone has submitted their ranking yet — you can still run matching, but unsubmitted
            members will be treated as having no preferences.
          </p>
        )}

        <button
          onClick={handleRun}
          disabled={running || loading || rows.length === 0}
          className="w-full py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
        >
          {running ? 'Running...' : 'Run Matching'}
        </button>
      </div>
    </div>
  );
};

export default Status;
