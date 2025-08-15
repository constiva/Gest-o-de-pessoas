import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';

interface Company {
  id: string;
  name: string;
  plan_id: string | null;
  plan_overrides: any;
}

export default function AdminCompanies() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
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
      const { data } = await supabase
        .from('companies')
        .select('id,name,plan_id,plan_overrides');
      setCompanies(data || []);
      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return <p>Carregando...</p>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">Empresas</h1>
      <table className="w-full text-left border">
        <thead>
          <tr>
            <th className="border p-2">Nome</th>
            <th className="border p-2">Plano</th>
            <th className="border p-2">Overrides</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id}>
              <td className="border p-2">{c.name}</td>
              <td className="border p-2">{c.plan_id}</td>
              <td className="border p-2">{JSON.stringify(c.plan_overrides)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
