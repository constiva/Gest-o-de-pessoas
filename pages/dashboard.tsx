import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import EmployeeStats from '../components/EmployeeStats';
import { LogOut, Users, PlusCircle } from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, inactive: 0, dismissed: 0 });
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/login');
      } else {
        const { data: employees } = await supabase.from('employees').select('status');
        const active = employees?.filter((e) => e.status === 'active').length || 0;
        const inactive = employees?.filter((e) => e.status === 'inactive').length || 0;
        const dismissed = employees?.filter((e) => e.status === 'dismissed').length || 0;
        setStats({ active, inactive, dismissed });
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
      <EmployeeStats active={stats.active} inactive={stats.inactive} dismissed={stats.dismissed} />
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <Link href="/employees" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Funcionários
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/employees/new" className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" /> Adicionar Funcionário
          </Link>
        </Button>
      </div>
    </Layout>
  );
}
