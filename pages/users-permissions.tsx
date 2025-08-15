import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';

export default function UsersPermissions() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState('viewer');

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.replace('/login');
        return;
      }
      const { data: userProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', session.session.user.id)
        .single();
      const cid = userProfile?.company_id;
      setCompanyId(cid);
      const { data: companyUsers } = await supabase
        .from('companies_users')
        .select('user_id, role')
        .eq('company_id', cid);
      if (companyUsers) {
        const enriched = await Promise.all(
          companyUsers.map(async (u: any) => {
            const { data: profile } = await supabase
              .from('users')
              .select('name,email')
              .eq('id', u.user_id)
              .single();
            return { ...u, name: profile?.name, email: profile?.email };
          })
        );
        setUsers(enriched);
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const addUser = async () => {
    if (!companyId) return;
    await supabase.from('companies_users').insert({
      company_id: companyId,
      user_id: newUserId,
      role: newRole,
    });
    setNewUserId('');
    const { data: companyUsers } = await supabase
      .from('companies_users')
      .select('user_id, role')
      .eq('company_id', companyId);
    if (companyUsers) {
      const enriched = await Promise.all(
        companyUsers.map(async (u: any) => {
          const { data: profile } = await supabase
            .from('users')
            .select('name,email')
            .eq('id', u.user_id)
            .single();
          return { ...u, name: profile?.name, email: profile?.email };
        })
      );
      setUsers(enriched);
    }
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">Usuários & Permissões</h1>
      <div className="mb-6">
        <input
          value={newUserId}
          onChange={(e) => setNewUserId(e.target.value)}
          placeholder="User ID"
          className="border p-2 mr-2"
        />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="border p-2 mr-2">
          <option value="owner">owner</option>
          <option value="admin">admin</option>
          <option value="manager">manager</option>
          <option value="viewer">viewer</option>
          <option value="custom">custom</option>
        </select>
        <Button onClick={addUser}>Adicionar</Button>
      </div>
      <table className="w-full text-left border">
        <thead>
          <tr>
            <th className="border p-2">Nome</th>
            <th className="border p-2">Email</th>
            <th className="border p-2">Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id}>
              <td className="border p-2">{u.name}</td>
              <td className="border p-2">{u.email}</td>
              <td className="border p-2">{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
