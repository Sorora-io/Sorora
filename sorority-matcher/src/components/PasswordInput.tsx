import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Button from './Button';

const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const label = props['aria-label'] || (props.id?.includes('confirm') ? 'confirm password' : props.id?.includes('new') ? 'new password' : 'password');
    return <div className="relative w-full">
      <input {...props} ref={ref} type={visible ? 'text' : 'password'} className={`${className} !pr-12`} />
      <Button variant="ghost" size="sm" className="!absolute right-1 top-1/2 -translate-y-1/2 !p-2 !min-h-[40px] !min-w-[40px]"
        aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} disabled={props.disabled}
        onMouseDown={event => event.preventDefault()} onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </Button>
    </div>;
  }
);
PasswordInput.displayName = 'PasswordInput';
export default PasswordInput;
