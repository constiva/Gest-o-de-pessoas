import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import '../styles/globals.css';

const defaultScopes = {
  dashboard: true,
  employees: true,
  recruitment: true,
  metrics: true,
  users: true,
};

const routeScopes: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/employees': 'employees',
  '/recruitment': 'recruitment',
  '/metrics': 'metrics',
  '/users': 'users',
};

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  useEffect(() => {
    const check = async () => {
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user;
      if (!user) return;
      const { data: compUser } = await supabase
        .from('companies_users')
        .select('scopes')
        .eq('user_id', user.id)
        .maybeSingle();
      const scopes = { ...defaultScopes, ...(compUser?.scopes || {}) };
      const scopeKey = Object.entries(routeScopes).find(([path]) =>
        router.pathname.startsWith(path)
      )?.[1];
      if (scopeKey && scopes[scopeKey] === false) {
        const fallback = '/dashboard';
        router.replace(router.pathname === fallback ? '/' : fallback);
      }
    };
    check();
  }, [router.pathname]);

  return <Component {...pageProps} />;
}
