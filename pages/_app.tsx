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

type CompanyScopeRow = {
  company_id: string;
  scopes: Record<string, boolean> | null;
};

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkScopes = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data: list, error: listErr } = await supabase
        .from<CompanyScopeRow>('companies_users')
        .select('company_id, scopes')
        .eq('user_id', user.id);

      if (listErr) {
        console.warn('Failed to load companies_users scopes', listErr);
      }

      const rows = list ?? [];
      let storedCompanyId: string | null = null;

      if (typeof window !== 'undefined') {
        try {
          storedCompanyId = localStorage.getItem('activeCompanyId');
        } catch {
          storedCompanyId = null;
        }
      }

      let activeCompanyId: string | null = null;
      if (storedCompanyId && rows.some((row) => row.company_id === storedCompanyId)) {
        activeCompanyId = storedCompanyId;
      } else if (rows.length > 0) {
        activeCompanyId = rows[0].company_id;
        if (typeof window !== 'undefined' && activeCompanyId) {
          try {
            localStorage.setItem('activeCompanyId', activeCompanyId);
          } catch {
            // ignore storage failures
          }
        }
      }

      const activeRow =
        rows.find((row) => row.company_id === activeCompanyId) ?? rows[0] ?? null;
      const scopes = { ...defaultScopes, ...(activeRow?.scopes ?? {}) };

      const scopeKey = Object.entries(routeScopes).find(([path]) =>
        router.pathname.startsWith(path)
      )?.[1];

      if (!cancelled && scopeKey && scopes[scopeKey] === false) {
        const fallback = '/dashboard';
        router.replace(router.pathname === fallback ? '/' : fallback);
      }
    };

    checkScopes();

    return () => {
      cancelled = true;
    };
  }, [router.pathname]);

  return <Component {...pageProps} />;
}
