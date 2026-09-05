import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { updateGroupSettings } from '../../lib/groups';

const Settings = () => {
  const { membership, refresh } = useGroup();
  const group = membership?.group;

  const [minBig, setMinBig] = useState(group?.min_big_rankings ?? 5);
  const [minLittle, setMinLittle] = useState(group?.min_little_rankings ?? 5);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!group) return null;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    const { error: saveError } = await updateGroupSettings(group.id, minBig, minLittle);
    if (saveError) {
      setError(saveError);
    } else {
      setSaved(true);
      await refresh();
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
          <h1 className="text-4xl font-bold text-center">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-6">Group Settings</h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Minimum Bigs a Little must rank
            </label>
            <input
              type="number"
              min={1}
              value={minLittle}
              onChange={(e) => setMinLittle(Number(e.target.value))}
              className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Minimum Littles a Big must rank
            </label>
            <input
              type="number"
              min={1}
              value={minBig}
              onChange={(e) => setMinBig(Number(e.target.value))}
              className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {saved && <p className="text-green-700 text-sm">Saved.</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? '...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
