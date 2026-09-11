import { ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'outline' | 'danger' | 'danger-outline' | 'ghost';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Drops horizontal padding (a full-width button doesn't need it — the
  // text centers in the full bar) rather than letting className override
  // px-*, which Tailwind's generated stylesheet order can't guarantee
  // wins over this component's own px-* class.
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-jade-600 text-white hover:bg-jade-700',
  outline: 'border border-jade-300 text-gray-900 hover:bg-jade-50',
  danger: 'bg-brick text-white hover:bg-brick-600',
  'danger-outline': 'border border-brick text-brick hover:bg-brick-50',
  ghost: 'border border-gray-300 text-gray-900 hover:bg-gray-100',
};

const SIZE_CLASSES: Record<ButtonSize, { padded: string; full: string }> = {
  sm: { padded: 'px-3 py-2 text-sm', full: 'py-2 text-sm' },
  md: { padded: 'px-6 py-2.5', full: 'py-2.5' },
};

// Every page in the app shares this handful of button looks — pulling
// them into one component means a future style change (spacing, colors,
// the "Tightened" pass) is a one-line edit here instead of a sed sweep
// across two dozen files.
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth = false, className = '', type = 'button', ...props }, ref) => {
    const sizeClass = fullWidth ? SIZE_CLASSES[size].full : SIZE_CLASSES[size].padded;
    const classes = [
      fullWidth ? 'w-full' : '',
      sizeClass,
      VARIANT_CLASSES[variant],
      'rounded-md font-medium transition-colors disabled:opacity-50',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return <button ref={ref} type={type} className={classes} {...props} />;
  }
);

Button.displayName = 'Button';

export default Button;
