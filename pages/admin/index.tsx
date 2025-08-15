import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import Link from 'next/link';

export default function Admin() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.replace('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', session.session.user.id)
        .single();
      if (!profile?.is_admin) {
        router.replace('/dashboard');
        return;
      }
      setAllowed(true);
      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return <p>Carregando...</p>;
  if (!allowed) return null;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">Admin</h1>
      <nav className="mb-6 space-x-4">
        <Link href="/admin/plans" className="text-brand">Planos</Link>
        <Link href="/admin/companies" className="text-brand">Empresas</Link>
        <Link href="/admin/subaccounts" className="text-brand">Subcontas</Link>
      </nav>
      <p>Selecione uma seção acima para gerenciar dados.</p>
    </Layout>
  );
}
