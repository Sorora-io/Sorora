import { HTMLAttributes } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AccountMenu from './AccountMenu';

const PageHeader = ({ children, className = '', superuserMode = false, ...props }: HTMLAttributes<HTMLElement> & { superuserMode?: boolean }) => {
  const { user } = useAuth();
  return (
    <header {...props} className={`flex flex-wrap items-center justify-between gap-x-5 gap-y-3 ${className}`}>
      {children}
      {user && <div className="ml-auto flex flex-wrap items-center gap-3"><AccountMenu superuserMode={superuserMode} /></div>}
    </header>
  );
};
export default PageHeader;
