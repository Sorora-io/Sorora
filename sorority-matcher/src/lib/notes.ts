import { supabase } from './supabase';

export type Interest = 'definitely' | 'would_like_to' | 'maybe' | 'probably_not';

export const INTEREST_LABEL: Record<Interest, string> = {
  definitely: 'Definitely',
  would_like_to: "I'd like to",
  maybe: 'Maybe — need more time',
  probably_not: 'Probably not the right match',
};

export interface Note {
  id: string;
  groupId: string;
  authorId: string;
  subjectId: string;
  eventDate: string | null;
  comment: string;
  interest: Interest | null;
  createdAt: string;
  updatedAt: string;
}

function fromRow(row: any): Note {
  return {
    id: row.id,
    groupId: row.group_id,
    authorId: row.author_id,
    subjectId: row.subject_id,
    eventDate: row.event_date,
    comment: row.comment,
    interest: row.interest,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Every note the signed-in user has written in a group, across everyone
// they've noted on — the Notes page groups these by subject client-side.
export async function getMyNotes(groupId: string): Promise<{ notes: Note[]; error: string | null }> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('group_id', groupId)
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) return { notes: [], error: error.message };
  return { notes: (data ?? []).map(fromRow), error: null };
}

export async function addNote(
  groupId: string,
  subjectId: string,
  fields: { eventDate: string | null; comment: string; interest: Interest | null }
): Promise<{ note: Note | null; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { note: null, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('notes')
    .insert({
      group_id: groupId,
      author_id: user.id,
      subject_id: subjectId,
      event_date: fields.eventDate,
      comment: fields.comment,
      interest: fields.interest,
    })
    .select()
    .single();

  if (error) return { note: null, error: error.message };
  return { note: fromRow(data), error: null };
}

export async function updateNote(
  noteId: string,
  fields: { eventDate: string | null; comment: string; interest: Interest | null }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('notes')
    .update({
      event_date: fields.eventDate,
      comment: fields.comment,
      interest: fields.interest,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId);
  return { error: error ? error.message : null };
}

export async function deleteNote(noteId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  return { error: error ? error.message : null };
}
