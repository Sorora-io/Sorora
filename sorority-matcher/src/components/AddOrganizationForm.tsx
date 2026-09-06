import { useState } from 'react';
import { useGroup } from '../contexts/GroupContext';
import { createGroup, findGroupByJoinCode, requestToJoinGroup, MembershipRole } from '../lib/groups';

interface AddOrganizationFormProps {
  onCreated: (groupId: string) => void;
  onJoined: (groupId: string) => void;
  onCancel?: () => void;
}

const AddOrganizationForm = ({ onCreated, onJoined, onCancel }: AddOrganizationFormProps) => {
  const { refresh } = useGroup();
  const [groupMode, setGroupMode] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('');
  const [school, setSchool] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [role, setRole] = useState<MembershipRole>('big');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (groupName.trim() === '') {
      setError('Please enter a name for your sorority group.');
      return;
    }
    if (school.trim() === '') {
      setError('Please enter the school this chapter is at.');
      return;
    }
    setLoading(true);
    setError('');
    const { group, error: createError } = await createGroup(groupName.trim(), school.trim());
    if (createError || !group) {
      setError(createError ?? 'Could not create the group.');
      setLoading(false);
      return;
    }
    await refresh();
    setLoading(false);
    onCreated(group.id);
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
    setLoading(false);
    onJoined(group.id);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setGroupMode('create'); setError(''); }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            groupMode === 'create' ? 'bg-jade-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Create a group
        </button>
        <button
          type="button"
          onClick={() => { setGroupMode('join'); setError(''); }}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            groupMode === 'join' ? 'bg-jade-600 text-white' : 'bg-gray-100 text-gray-600'
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
              className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">School</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. New York University"
              className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>
          {error && <p className="text-brick text-sm">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
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
              className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">I am a</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MembershipRole)}
              className="w-full p-3 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            >
              <option value="big">Big</option>
              <option value="little">Little</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-brick text-sm">{error}</p>}
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
          >
            {loading ? '...' : 'Request to Join'}
          </button>
        </div>
      )}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2 text-sm text-gray-500 hover:text-black"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export default AddOrganizationForm;
