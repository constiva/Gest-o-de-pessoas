import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/button';

interface CompanyUser {
  user_id: string;
  email?: string;
  phone?: string | null;
}

export default function CompanyUsersPage() {
  const [companyId, setCompanyId] = useState<string>('');
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string>('');


  const loadUsers = async (cid: string) => {
    const res = await fetch(`/api/company-users?company_id=${cid}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('companies_users')
        .select('company_id')
        .eq('user_id', session.user.id)

        .single();
      if (data) {
        setCompanyId(data.company_id);
        loadUsers(data.company_id);
      }
    };
    init();
  }, []);

  const addUser = async () => {
    setError('');
    const res = await fetch('/api/company-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, phone, company_id: companyId }),
    });
    if (res.ok) {
      setEmail('');
      setPassword('');
      setPhone('');
      loadUsers(companyId);
    } else {
      const { error: err } = await res.json();
      setError(err || 'Erro ao adicionar usuário');
    }
  };

  const updateUser = async (u: CompanyUser) => {
    const newPassword = prompt('Nova senha (deixe vazio para manter):');
    const newPhone = prompt('Novo telefone:', u.phone || '');
    await fetch('/api/company-users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: u.user_id, password: newPassword || undefined, phone: newPhone || undefined }),
    });
    loadUsers(companyId);
  };

  const removeUser = async (u: CompanyUser) => {
    if (!confirm('Excluir este usuário?')) return;
    await fetch(`/api/company-users?id=${u.user_id}&company_id=${companyId}`, { method: 'DELETE' });
    loadUsers(companyId);
  };

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">Usuários & Permissões</h1>
      <div className="mb-6 flex gap-2 flex-wrap">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Telefone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="border p-2 rounded"
        />
        <Button onClick={addUser} disabled={!companyId}>
          Adicionar
        </Button>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="p-2 border-b">Email</th>
            <th className="p-2 border-b">Telefone</th>
            <th className="p-2 border-b">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id}>
              <td className="p-2 border-b">{u.email}</td>
              <td className="p-2 border-b">{u.phone || '-'}</td>
              <td className="p-2 border-b space-x-2">
                <Button variant="outline" onClick={() => updateUser(u)}>
                  Editar
                </Button>
                <Button variant="outline" onClick={() => removeUser(u)}>
                  Excluir
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}

