import { useState } from 'react';

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-20 w-20 text-3xl',
};

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: keyof typeof sizes;
  alt?: string;
}

// One crop, shape, and fallback for every profile-photo surface.
const Avatar = ({ src, name, email, size = 'md', alt = '' }: AvatarProps) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = (words.length > 1
    ? `${words[0][0]}${words[words.length - 1][0]}`
    : words[0]?.[0] || email?.trim()[0] || '?').toUpperCase();
  const showPhoto = !!src && src !== failedUrl;

  return (
    <span className={`${sizes[size]} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--ss-pill-bg)] font-medium text-[color:var(--ss-jade)]`}>
      {showPhoto ? (
        <img src={src} alt={alt} className="block h-full w-full object-cover object-center" onError={() => setFailedUrl(src)} />
      ) : (
        <span role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>{initials}</span>
      )}
    </span>
  );
};

export default Avatar;
