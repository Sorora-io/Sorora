import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { getRoster, RosterMember } from '../../lib/rankings';
import { getMyNotes, addNote, updateNote, deleteNote, Note, Interest, INTEREST_LABEL } from '../../lib/notes';

const INTEREST_OPTIONS: Interest[] = ['definitely', 'would_like_to', 'maybe', 'probably_not'];

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const Notes = () => {
  const { membership } = useGroup();
  const group = membership?.group;
  const role = membership?.role;
  const oppositeRole = role === 'big' ? 'little' : 'big';
  const oppositeLabel = oppositeRole === 'big' ? 'Bigs' : 'Littles';

  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState(todayISO());
  const [comment, setComment] = useState('');
  const [interest, setInterest] = useState<Interest | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!group || !oppositeRole) return;
    setLoading(true);
    const [{ roster: r, error: rosterError }, { notes: n, error: notesError }] = await Promise.all([
      getRoster(group.id, oppositeRole),
      getMyNotes(group.id),
    ]);
    if (rosterError) setError(rosterError);
    else if (notesError) setError(notesError);
    setRoster(r);
    setNotes(n);
    setLoading(false);
  }, [group, oppositeRole]);

  useEffect(() => {
    load();
  }, [load]);

  if (!group || !role) return null;

  const notesFor = (subjectId: string) => notes.filter(n => n.subjectId === subjectId);

  const resetForm = () => {
    setEditingNoteId(null);
    setEventDate(todayISO());
    setComment('');
    setInterest(null);
    setFormError('');
  };

  const openCandidate = (subjectId: string) => {
    if (openSubjectId === subjectId) {
      setOpenSubjectId(null);
      resetForm();
    } else {
      setOpenSubjectId(subjectId);
      resetForm();
    }
  };

  const startEdit = (note: Note) => {
    setOpenSubjectId(note.subjectId);
    setEditingNoteId(note.id);
    setEventDate(note.eventDate ?? todayISO());
    setComment(note.comment);
    setInterest(note.interest);
    setFormError('');
  };

  const handleSave = async () => {
    if (!openSubjectId) return;
    setSaving(true);
    setFormError('');
    const fields = { eventDate: eventDate || null, comment: comment.trim(), interest };

    if (editingNoteId) {
      const { error: saveError } = await updateNote(editingNoteId, fields);
      if (saveError) {
        setFormError(saveError);
        setSaving(false);
        return;
      }
      setNotes(prev => prev.map(n => (n.id === editingNoteId ? { ...n, ...fields } : n)));
    } else {
      const { note, error: saveError } = await addNote(group.id, openSubjectId, fields);
      if (saveError || !note) {
        setFormError(saveError ?? 'Could not save note.');
        setSaving(false);
        return;
      }
      setNotes(prev => [note, ...prev]);
    }
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (noteId: string) => {
    const { error: deleteError } = await deleteNote(noteId);
    if (deleteError) {
      setFormError(deleteError);
      return;
    }
    setNotes(prev => prev.filter(n => n.id !== noteId));
    if (editingNoteId === noteId) resetForm();
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-2xl w-full">
        <h2 className="text-2xl font-semibold mb-1">Notes</h2>
        <p className="text-gray-500 text-sm mb-1">
          Keep a private log on the {oppositeLabel.toLowerCase()} you're getting to know — only you can
          ever see these.
        </p>
        {error && <p className="text-brick text-sm mt-2">{error}</p>}

        {loading ? (
          <p className="text-gray-500 mt-6">Loading...</p>
        ) : roster.length === 0 ? (
          <p className="text-gray-400 text-sm mt-6">No {oppositeLabel.toLowerCase()} to note on yet.</p>
        ) : (
          <div className="flex flex-col gap-2 mt-6">
            {roster.map(person => {
              const open = openSubjectId === person.userId;
              const personNotes = notesFor(person.userId);
              return (
                <div key={person.userId} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => openCandidate(person.userId)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-jade-50 transition-colors"
                  >
                    <span className="font-medium">{person.name || person.email}</span>
                    <span className="text-xs text-gray-400">
                      {personNotes.length > 0 ? `${personNotes.length} note${personNotes.length === 1 ? '' : 's'}` : 'No notes yet'}
                    </span>
                  </button>

                  {open && (
                    <div className="px-5 pb-5 flex flex-col gap-4 border-t border-gray-100 pt-4">
                      {personNotes.length > 0 && (
                        <div className="flex flex-col gap-3">
                          {personNotes.map(note => (
                            <div key={note.id} className="border-2 border-gray-100 rounded-md p-3">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {note.eventDate && (
                                    <span className="text-xs font-medium text-gray-500">{formatDate(note.eventDate)}</span>
                                  )}
                                  {note.interest && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-jade-100 text-jade-700">
                                      {INTEREST_LABEL[note.interest]}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => startEdit(note)}
                                    className="text-xs underline text-gray-500 hover:text-black"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(note.id)}
                                    className="text-xs underline text-gray-500 hover:text-brick"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {note.comment && <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.comment}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {editingNoteId ? 'Edit note' : 'Add a note'}
                        </p>
                        <input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="w-full p-2 text-sm border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                        />
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="What do you want to remember about this?"
                          rows={2}
                          className="w-full p-2 text-sm border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 resize-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {INTEREST_OPTIONS.map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setInterest(interest === opt ? null : opt)}
                              className={`text-xs font-medium px-2 py-2 rounded-md border-2 transition-colors ${
                                interest === opt
                                  ? 'bg-jade-600 border-jade-600 text-white'
                                  : 'border-gray-200 text-gray-600 hover:bg-jade-50'
                              }`}
                            >
                              {INTEREST_LABEL[opt]}
                            </button>
                          ))}
                        </div>
                        {formError && <p className="text-brick text-xs">{formError}</p>}
                        <div className="flex gap-2">
                          {editingNoteId && (
                            <button
                              onClick={resetForm}
                              className="flex-1 py-2 text-sm border-2 border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 py-2 text-sm bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
                          >
                            {saving ? '...' : editingNoteId ? 'Save Changes' : 'Add Note'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
