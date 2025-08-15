import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';

interface Plan {
  id: string;
  name: string;
  plan_description: string | null;
  features: any;
}

export default function AdminPlans() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
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
      const { data } = await supabase.from('plans').select('*');
      setPlans(data || []);
      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return <p>Carregando...</p>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">Planos</h1>
      <table className="w-full text-left border">
        <thead>
          <tr>
            <th className="border p-2">Nome</th>
            <th className="border p-2">Descrição</th>
            <th className="border p-2">Features</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id}>
              <td className="border p-2">{p.name}</td>
              <td className="border p-2">{p.plan_description}</td>
              <td className="border p-2">{JSON.stringify(p.features)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
