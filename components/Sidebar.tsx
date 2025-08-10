import Link from 'next/link';
import { useRouter } from 'next/router';
import { LayoutDashboard, Users } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Sidebar() {
  const router = useRouter();
  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/employees', label: 'Funcionários', icon: Users },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen p-6">
      <h2 className="text-2xl font-bold text-brand mb-8">Constiva</h2>
      <nav className="flex flex-col space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700',
              router.pathname.startsWith(href) && 'bg-gray-100 dark:bg-gray-700'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
