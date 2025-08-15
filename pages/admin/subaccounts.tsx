import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';

interface Entry {
  company_id: string;
  user_id: string;
  role: string;
  companyName?: string;
  userName?: string;
  email?: string;
}

export default function AdminSubaccounts() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
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
      const { data: cu } = await supabase
        .from('companies_users')
        .select('company_id,user_id,role');
      if (cu) {
        const enriched = await Promise.all(
          cu.map(async (item: any) => {
            const { data: company } = await supabase
              .from('companies')
              .select('name')
              .eq('id', item.company_id)
              .single();
            const { data: user } = await supabase
              .from('users')
              .select('name,email')
              .eq('id', item.user_id)
              .single();
            return {
              ...item,
              companyName: company?.name,
              userName: user?.name,
              email: user?.email,
            };
          })
        );
        setEntries(enriched);
      }
      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return <p>Carregando...</p>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">Subcontas</h1>
      <table className="w-full text-left border">
        <thead>
          <tr>
            <th className="border p-2">Empresa</th>
            <th className="border p-2">Usuário</th>
            <th className="border p-2">Email</th>
            <th className="border p-2">Role</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={`${e.company_id}-${e.user_id}`}>
              <td className="border p-2">{e.companyName}</td>
              <td className="border p-2">{e.userName}</td>
              <td className="border p-2">{e.email}</td>
              <td className="border p-2">{e.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
