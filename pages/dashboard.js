import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/login');
      } else {
        setUser(data.session.user);
        const { data: userRow } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', data.session.user.id)
          .single();
        const { data: employees } = await supabase
          .from('employees')
          .select('status, hire_date, termination_date')
          .eq('company_id', userRow.company_id);
        const active = employees.filter((e) => e.status === 'active');
        const inactive = employees.filter((e) => e.status === 'inactive');
        const dismissed = employees.filter((e) => e.status === 'dismissed');
        const avgTenure = active.length
          ? (
              active.reduce(
                (sum, e) => sum + (Date.now() - new Date(e.hire_date).getTime()),
                0
              ) /
              active.length /
              (1000 * 60 * 60 * 24)
            ).toFixed(1)
          : 0;
        setMetrics({
          active: active.length,
          inactive: inactive.length,
          dismissed: dismissed.length,
          avgTenure
        });
      }
    };
    loadUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!user || !metrics) return <p>Loading...</p>;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Bem vindo {user.email}</p>
      <div>
        <p>Funcionários ativos: {metrics.active}</p>
        <p>Funcionários inativos: {metrics.inactive}</p>
        <p>Funcionários desligados: {metrics.dismissed}</p>
        <p>Média de tempo de casa (dias): {metrics.avgTenure}</p>
      </div>
      <button onClick={handleLogout}>Sair</button>
    </div>
  );
}
