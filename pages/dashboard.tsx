import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/login');
      } else {
        setLoading(false);
      }
    };
    checkSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="space-x-4">
        <Link href="/employees" className="text-brand hover:underline">
          Funcionários
        </Link>
        <Link href="/employees/new" className="text-brand hover:underline">
          Adicionar Funcionário
        </Link>
      </div>
      <div className="mt-6">
        <Button onClick={handleLogout}>Sair</Button>
      </div>
    </Layout>
  );
}
