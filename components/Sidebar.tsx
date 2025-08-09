import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '../lib/utils';

export default function Sidebar() {
  const router = useRouter();
  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/employees', label: 'Funcionários' },
  ];

  return (
    <aside className="w-64 bg-purple-50 min-h-screen p-4 border-r border-purple-100">
      <h2 className="text-xl font-bold text-purple-700 mb-6">Menu</h2>
      <nav className="flex flex-col space-y-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'px-3 py-2 rounded text-purple-700 hover:bg-purple-100',
              router.pathname.startsWith(l.href) && 'bg-purple-100 font-medium'
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
