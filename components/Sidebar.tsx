import Link from 'next/link';
import { useRouter } from 'next/router';
import { LayoutDashboard, Users, User as UserIcon, UserCog, BarChart3, Briefcase } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Sidebar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const { data: profileData } = await supabase
        .from('users')
        .select('name,email')
        .eq('id', user.id)
        .maybeSingle();
      if (profileData) {
        setProfile(profileData);
        return;
      }
      const { data: companyUser } = await supabase
        .from('companies_users')
        .select('name,email')
        .eq('user_id', user.id)
        .maybeSingle();
      if (companyUser) {
        setProfile(companyUser);
        return;
      }
      const { data: unitUser } = await supabase
        .from('companies_units')
        .select('name,email')
        .eq('user_id', user.id)
        .maybeSingle();
      if (unitUser) setProfile(unitUser);
    });
  }, []);

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/employees', label: 'Funcionários', icon: Users },
    { href: '/recruitment', label: 'Recrutamento & Seleção', icon: Briefcase },
    { href: '/metrics', label: 'Métricas', icon: BarChart3 },
    { href: '/users', label: 'Usuários & Permissões', icon: UserCog },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen p-6 flex flex-col">
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
      <div className="mt-auto relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <UserIcon className="h-5 w-5" />
        </button>
        {menuOpen && profile && (
          <div className="absolute left-3 right-3 bottom-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-3 text-sm">
            <p className="font-medium">{profile.name}</p>
            <p className="text-xs text-gray-500 mb-2">{profile.email}</p>
            <Link
              href="/account"
              className="block text-brand hover:underline mb-1"
              onClick={() => setMenuOpen(false)}
            >
              Conta
            </Link>
            <Link
              href="/upgrade"
              className="block text-brand hover:underline"
              onClick={() => setMenuOpen(false)}
            >
              Upgrade
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
