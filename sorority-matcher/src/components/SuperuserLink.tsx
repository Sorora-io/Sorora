import { Link } from 'react-router-dom';
import { useSuperuser } from '../hooks/useSuperuser';

export default function SuperuserLink() {
  const { data } = useSuperuser();
  return data ? <Link to="/superuser" className="block rounded-xl px-3 py-2 text-sm text-[color:var(--ss-ink-2)] hover:bg-stone-100">Superuser</Link> : null;
}
