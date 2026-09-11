import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useGroup } from '../../contexts/GroupContext';
import { getRoster } from '../../lib/rankings';
import { getMyNotes, addNote, updateNote, deleteNote, Note, Interest, INTEREST_LABEL } from '../../lib/notes';
import { queryKeys } from '../../lib/queryKeys';
import LoadingLogo from '../../components/LoadingLogo';
import Button from '../../components/Button';

const INTEREST_OPTIONS: Interest[] = ['definitely', 'would_like_to', 'maybe', 'probably_not'];

const UNDO_WINDOW_MS = 5000;

const todayISO = () => new Date().toISOString().slice(0, 10);

// Matches getMyNotes' own ordering (event_date desc, nulls last, then
// created_at desc) so an undone delete reinserts where it originally was
// instead of just jumping to the top of the list.
function compareNotes(a: Note, b: Note): number {
  if (a.eventDate !== b.eventDate) {
    if (a.eventDate === null) return 1;
    if (b.eventDate === null) return -1;
    return a.eventDate < b.eventDate ? 1 : -1;
  }
  return a.createdAt < b.createdAt ? 1 : -1;
}

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

  const queryClient = useQueryClient();

  // Shares its cache key with SubmitRanking — whichever page the member
  // visited first already has the roster warm.
  const { data: roster = [], isLoading: rosterLoading, error: rosterQueryError } = useQuery({
    queryKey: queryKeys.groupRoster(group?.id ?? '', oppositeRole),
    queryFn: () => getRoster(group!.id, oppositeRole).then(({ roster: r }) => r),
    enabled: !!group,
  });

  const { data: notesData, isLoading: notesLoading, error: notesQueryError } = useQuery({
    queryKey: queryKeys.myNotes(group?.id ?? ''),
    queryFn: () => getMyNotes(group!.id).then(({ notes: n, error: notesError }) => {
      if (notesError) throw new Error(notesError);
      return n;
    }),
    enabled: !!group,
  });

  // notes is a local, freely-mutated mirror of the cache, not a direct read
  // of it — the undo-delete flow below needs to add/remove rows on its own
  // timeline (independent of any refetch), so it seeds from the cache
  // exactly once rather than staying subscribed to it. Every mutation
  // below writes through to the cache too (via updateNotes), so revisiting
  // this page within the cache's staleTime still sees the latest edits.
  const [notes, setNotes] = useState<Note[]>([]);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !notesData) return;
    setNotes(notesData);
    seeded.current = true;
  }, [notesData]);

  const updateNotes = (updater: (prev: Note[]) => Note[]) => {
    setNotes(updater);
    if (group) {
      queryClient.setQueryData<Note[]>(queryKeys.myNotes(group.id), prev => updater(prev ?? []));
    }
  };

  const loading = (rosterLoading || notesLoading) && !seeded.current;
  const error = rosterQueryError
    ? (rosterQueryError as Error).message
    : notesQueryError
    ? (notesQueryError as Error).message
    : '';

  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState(todayISO());
  const [comment, setComment] = useState('');
  const [interest, setInterest] = useState<Interest | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Notes "deleted" via the undo toast aren't actually deleted from the
  // database until the toast's window closes without Undo being clicked —
  // this map tracks that pending timeout per note so Undo can cancel it.
  // Deliberately never cleared on unmount: a pending delete should still go
  // through in the background if the user navigates away before it fires,
  // not silently get canceled.
  const pendingDeletes = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
      updateNotes(prev => prev.map(n => (n.id === editingNoteId ? { ...n, ...fields } : n)));
    } else {
      const { note, error: saveError } = await addNote(group.id, openSubjectId, fields);
      if (saveError || !note) {
        setFormError(saveError ?? 'Could not save note.');
        setSaving(false);
        return;
      }
      updateNotes(prev => [note, ...prev]);
    }
    resetForm();
    setSaving(false);
  };

  const handleDelete = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    // Optimistic: the note disappears from the list right away, but the
    // actual database delete waits out the toast's undo window first.
    updateNotes(prev => prev.filter(n => n.id !== noteId));
    if (editingNoteId === noteId) resetForm();

    const timeoutId = setTimeout(async () => {
      delete pendingDeletes.current[noteId];
      const { error: deleteError } = await deleteNote(noteId);
      if (deleteError) {
        toast.error(`Couldn't delete that note: ${deleteError}`);
        updateNotes(prev => [...prev, note].sort(compareNotes));
      }
    }, UNDO_WINDOW_MS);
    pendingDeletes.current[noteId] = timeoutId;

    toast('Note deleted', {
      duration: UNDO_WINDOW_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = pendingDeletes.current[noteId];
          if (!pending) return; // the window already closed and it's gone
          clearTimeout(pending);
          delete pendingDeletes.current[noteId];
          updateNotes(prev => [...prev, note].sort(compareNotes));
        },
      },
    });
  };

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

        <h2 className="text-2xl font-semibold mb-1">Notes</h2>
        <p className="text-gray-500 text-sm mb-1">
          Keep a private log on the {oppositeLabel.toLowerCase()} you're getting to know — only you can
          ever see these.
        </p>
        {error && <p className="text-brick text-sm mt-2">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 mt-6"><LoadingLogo size={20} /> Loading...</div>
        ) : roster.length === 0 ? (
          <p className="text-gray-400 text-sm mt-6">No {oppositeLabel.toLowerCase()} to note on yet.</p>
        ) : (
          <div className="flex flex-col gap-2 mt-6">
            {roster.map(person => {
              const open = openSubjectId === person.userId;
              const personNotes = notesFor(person.userId);
              return (
                <div key={person.userId} className="bg-white rounded-lg shadow-sm overflow-hidden">
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
                            <div key={note.id} className="border border-gray-100 rounded-md p-3">
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
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          {editingNoteId ? 'Edit note' : 'Add a note'}
                        </p>
                        <input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="w-full p-2 text-sm border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
                        />
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="What do you want to remember about this?"
                          rows={2}
                          className="w-full p-2 text-sm border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100 resize-none"
                        />
                        <p className="text-sm text-gray-700">Would you want to meet again?</p>
                        <div className="grid grid-cols-2 gap-2">
                          {INTEREST_OPTIONS.map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setInterest(interest === opt ? null : opt)}
                              className={`text-xs font-medium px-2 py-2 rounded-md border transition-colors ${
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
                            <Button variant="ghost" size="sm" className="flex-1" onClick={resetForm}>
                              Cancel
                            </Button>
                          )}
                          <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
                            {saving ? '...' : editingNoteId ? 'Save Changes' : 'Add Note'}
                          </Button>
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
