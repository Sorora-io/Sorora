import { supabase } from './supabase';

export interface MyProfile {
  id: string;
  email: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  major: string | null;
  college: string | null;
  year: string | null;
  hometown: string | null;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export async function getMyProfile(): Promise<{ profile: MyProfile | null; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { profile: null, error: null };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, bio, avatar_url, major, college, year, hometown')
    .eq('id', user.id)
    .single();

  if (error) return { profile: null, error: error.message };
  return { profile: data as MyProfile, error: null };
}

export async function updateMyProfile(
  name: string,
  bio: string,
  avatarUrl: string | null,
  major: string,
  college: string,
  year: string,
  hometown: string
): Promise<{ profile: MyProfile | null; error: string | null }> {
  const { data, error } = await supabase.rpc('update_my_profile', {
    p_name: name,
    p_bio: bio,
    p_avatar_url: avatarUrl,
    p_major: major,
    p_college: college,
    p_year: year,
    p_hometown: hometown,
  });
  if (error) return { profile: null, error: error.message };
  return { profile: data as MyProfile, error: null };
}

// Permanently deletes the signed-in user's account. The RPC deletes the
// underlying auth.users row (security definer, hardcoded to auth.uid() so
// it can only ever target the caller's own account); every profile,
// membership, ranking, pairing, and note referencing them cascades away
// with it. Blocked server-side if they still own a chapter — see the
// migration for why.
export async function deleteMyAccount(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('delete_my_account');
  return { error: error ? error.message : null };
}

export async function uploadAvatar(file: File): Promise<{ url: string | null; error: string | null }> {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return { url: null, error: 'Please choose a PNG, JPEG, GIF, or WebP image.' };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { url: null, error: 'Image must be under 5MB.' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: 'Not signed in.' };

  const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${user.id}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { url: null, error: uploadError.message };

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Cache-bust so a re-upload at the same path shows immediately instead of
  // the browser's cached copy of the old image at that URL.
  const url = `${data.publicUrl}?t=${Date.now()}`;
  return { url, error: null };
}
