import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { homeForRole } from '../../components/RequireGroupRole';
import { createGroup, findGroupByJoinCode, requestToJoinGroup, MembershipRole } from '../../lib/groups';

const Onboarding = () => {
  const navigate = useNavigate();
  const { membership, loading: groupLoading, refresh } = useGroup();

  // Someone with an existing membership shouldn't see the create/join form
  // (e.g. they navigated here manually, or the auto-submit from signup
  // already ran) — send them to wherever they actually belong.
  useEffect(() => {
    if (groupLoading || !membership) return;
    navigate(membership.status === 'approved' ? homeForRole(membership.role) : '/group/pending', { replace: true });
  }, [groupLoading, membership, navigate]);

  const [groupMode, setGroupMode] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [role, setRole] = useState<MembershipRole>('big');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (groupName.trim() === '') {
      setError('Please enter a name for your sorority group.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: createError } = await createGroup(groupName.trim());
    if (createError) {
      setError(createError);
      setLoading(false);
      return;
    }
    await refresh();
    navigate('/group/approvals');
  };

  const handleJoin = async () => {
    if (joinCode.trim() === '') {
      setError("Please enter your group's join code.");
      return;
    }
    setLoading(true);
    setError('');
    const { group, error: codeError } = await findGroupByJoinCode(joinCode);
    if (codeError || !group) {
      setError(codeError ?? 'No group found with that code.');
      setLoading(false);
      return;
    }
    const { error: joinError } = await requestToJoinGroup(group.id, role);
    if (joinError) {
      setError(joinError);
      setLoading(false);
      return;
    }
    await refresh();
    navigate('/group/pending');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
          <h1 className="text-4xl font-bold text-center">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-6">Get started</h2>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setGroupMode('create'); setError(''); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              groupMode === 'create' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Create a group
          </button>
          <button
            type="button"
            onClick={() => { setGroupMode('join'); setError(''); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              groupMode === 'join' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Join a group
          </button>
        </div>

        {groupMode === 'create' ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Sorority group name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Alpha Beta Chapter"
                className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Create Group'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Join code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. XK7P2QRT"
                className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">I am a</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as MembershipRole)}
                className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
              >
                <option value="big">Big</option>
                <option value="little">Little</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Request to Join'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
