import { ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'outline'
  | 'quiet'
  | 'ghost'
  | 'link'
  | 'danger'
  | 'danger-outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

// Pill buttons matching the sorora-story canvas. `primary` is the deep-jade
// CTA ("Continue", "Show me around"). `outline` is the ink-outline pill
// ("Join a chapter", "I'm a Big" unselected, "Edit my profile"). `quiet`
// is the softer sage-tinted secondary. `link` is the underlined shortcut
// ("Use sample profile", "Replay the tour"). Danger variants keep their
// own palette so destructive actions stay visually distinct.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[color:var(--ss-jade-deep)] text-white border border-transparent hover:bg-[color:var(--ss-jade)]',
  outline:
    'border border-[color:var(--ss-jade-line)] bg-transparent text-[color:var(--ss-ink-2)] hover:bg-white/60',
  quiet:
    'border border-[color:var(--ss-surface-border)] bg-[color:var(--ss-surface)] text-[color:var(--ss-ink-3)] hover:bg-white/70',
  ghost:
    'border border-transparent bg-transparent text-[color:var(--ss-ink-4)] hover:bg-white/50 hover:text-[color:var(--ss-ink-2)]',
  link:
    'border-0 bg-transparent text-[color:var(--ss-ink-3)] underline underline-offset-4 hover:text-[color:var(--ss-ink-1)]',
  danger:
    'bg-brick text-white border border-transparent hover:bg-brick-600',
  'danger-outline':
    'border border-brick text-brick bg-transparent hover:bg-brick-50',
};

const SIZE_CLASSES: Record<ButtonSize, { padded: string; full: string }> = {
  sm: { padded: 'px-5 py-2 text-sm min-h-[36px]', full: 'py-2 text-sm min-h-[36px]' },
  md: { padded: 'px-7 py-3 text-[15px] min-h-[48px]', full: 'py-3 text-[15px] min-h-[48px]' },
  lg: { padded: 'px-10 py-3.5 text-base min-h-[54px]', full: 'py-3.5 text-base min-h-[54px]' },
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth = false, className = '', type = 'button', ...props }, ref) => {
    const sizeClass = fullWidth ? SIZE_CLASSES[size].full : SIZE_CLASSES[size].padded;
    const shape = variant === 'link' ? '' : 'rounded-pill';
    const classes = [
      fullWidth ? 'w-full' : '',
      'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
      sizeClass,
      shape,
      VARIANT_CLASSES[variant],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return <button ref={ref} type={type} className={classes} {...props} />;
  }
);

Button.displayName = 'Button';

export default Button;
