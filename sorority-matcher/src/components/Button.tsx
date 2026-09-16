import { ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'outline'
  | 'quiet'
  | 'ghost'
  | 'link'
  | 'danger'
  | 'danger-outline';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

// Pill-shaped buttons matching the sorora-story canvas. `primary` is the
// deep-jade CTA, `outline` its high-contrast counterpart, `quiet` the soft
// sage secondary the design uses next to a primary action, `ghost` a
// borderless dashboard tab, `link` the underlined "Use sample profile"
// shortcut, and the two danger variants keep destructive actions visually
// distinct from everything else.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[color:var(--ss-jade-deep)] text-white border border-transparent shadow-surface hover:bg-[color:var(--ss-jade)]',
  outline:
    'border border-[color:var(--ss-jade-deep)] text-[color:var(--ss-ink-2)] bg-transparent hover:bg-[color:var(--ss-surface)]',
  quiet:
    'border border-[color:var(--ss-jade-line)] bg-[color:var(--ss-surface)] text-[color:var(--ss-ink-3)] hover:bg-white/60',
  ghost:
    'border border-transparent text-[color:var(--ss-ink-4)] hover:bg-white/50 hover:text-[color:var(--ss-ink-2)]',
  link:
    'border-0 bg-transparent text-[color:#375b49] underline underline-offset-4 hover:text-[color:var(--ss-jade-deep)]',
  danger:
    'bg-brick text-white border border-transparent hover:bg-brick-600',
  'danger-outline':
    'border border-brick text-brick bg-transparent hover:bg-brick-50',
};

const SIZE_CLASSES: Record<ButtonSize, { padded: string; full: string }> = {
  sm: { padded: 'px-4 py-2 text-sm min-h-[36px]', full: 'py-2 text-sm min-h-[36px]' },
  md: { padded: 'px-5 py-3 text-[15px] min-h-[44px]', full: 'py-3 text-[15px] min-h-[44px]' },
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth = false, className = '', type = 'button', ...props }, ref) => {
    const sizeClass = fullWidth ? SIZE_CLASSES[size].full : SIZE_CLASSES[size].padded;
    const shape = variant === 'link' ? '' : 'rounded-pill';
    const classes = [
      fullWidth ? 'w-full' : '',
      'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
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
