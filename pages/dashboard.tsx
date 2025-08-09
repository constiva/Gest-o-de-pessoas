import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

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
    <div>
      <h1>Dashboard</h1>
      <Link href="/employees">Funcionários</Link>
      <br />
      <Link href="/employees/new">Adicionar Funcionário</Link>
      <div>
        <button onClick={handleLogout}>Sair</button>
      </div>
    </div>
  );
}
