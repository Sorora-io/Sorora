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

// Shared buttons use the control corner token. `primary` is the deep-jade
// CTA ("Continue", "Show me around"). `outline` is the outlined action
// ("Join a chapter", "I'm a Big" unselected, "Edit my profile"). `quiet`
// is the softer sage-tinted secondary. `link` is the underlined shortcut
// ("Use sample profile", "Replay the tour"). Danger variants keep their
// own palette so destructive actions stay visually distinct.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[color:var(--ss-jade-deep)] text-white border border-transparent enabled:hover:bg-[color:var(--ss-button-primary-hover)]',
  outline:
    'border border-[color:var(--ss-jade-line)] bg-transparent text-[color:var(--ss-ink-2)] enabled:hover:bg-[color:var(--ss-button-hover)] enabled:hover:border-[color:var(--ss-jade-soft)]',
  quiet:
    'border border-[color:var(--ss-surface-border)] bg-[color:var(--ss-surface)] text-[color:var(--ss-ink-3)] enabled:hover:bg-[color:var(--ss-button-quiet-hover)] enabled:hover:border-[color:var(--ss-jade-line)]',
  ghost:
    'border border-transparent bg-transparent text-[color:var(--ss-ink-4)] enabled:hover:bg-[color:var(--ss-button-hover)] enabled:hover:text-[color:var(--ss-ink-2)]',
  link:
    'border-0 bg-transparent text-[color:var(--ss-ink-3)] underline underline-offset-4 enabled:hover:text-[color:var(--ss-ink-1)]',
  danger:
    'bg-brick text-white border border-transparent enabled:hover:bg-brick-600',
  'danger-outline':
    'border border-brick text-brick bg-transparent enabled:hover:bg-brick-50',
};

const SIZE_CLASSES: Record<ButtonSize, { padded: string; full: string }> = {
  sm: { padded: 'px-5 py-2 text-sm min-h-[36px]', full: 'py-2 text-sm min-h-[36px]' },
  md: { padded: 'px-7 py-3 text-[15px] min-h-[48px]', full: 'py-3 text-[15px] min-h-[48px]' },
  lg: { padded: 'px-10 py-3.5 text-base min-h-[54px]', full: 'py-3.5 text-base min-h-[54px]' },
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth = false, className = '', type = 'button', ...props }, ref) => {
    const sizeClass = fullWidth ? SIZE_CLASSES[size].full : SIZE_CLASSES[size].padded;
    const shape = variant === 'link' ? '' : 'rounded-control';
    const classes = [
      fullWidth ? 'w-full' : '',
      'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 ease-out motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ss-jade-soft)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
      sizeClass,
      shape,
      className.split(/\s+/).includes('ss-tab') ? '' : VARIANT_CLASSES[variant],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return <button ref={ref} type={type} className={classes} {...props} />;
  }
);

Button.displayName = 'Button';

export default Button;
