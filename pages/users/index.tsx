import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/button';

interface CompanyUser {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
}

export default function CompanyUsersPage() {
  const [companyId, setCompanyId] = useState<string>('');
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [loadingCompany, setLoadingCompany] = useState(true);

  const loadUsers = async (cid: string) => {
    const res = await fetch(`/api/company-users?company_id=${cid}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
  };

  const loadPositions = async (cid: string) => {
    const { data } = await supabase
      .from('employees')
      .select('position')
      .eq('company_id', cid)
      .not('position', 'is', null);
    if (data) {
      const unique = Array.from(new Set(data.map((e: any) => e.position)));
      setPositions(unique as string[]);
    }
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoadingCompany(false);
        return;
      }
      const { data } = await supabase
        .from('companies_users')
        .select('company_id')
        .eq('user_id', session.user.id)
        .single();
      if (data) {
        setCompanyId(data.company_id);
        loadUsers(data.company_id);
        loadPositions(data.company_id);
      } else {
        const { data: fallback } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', session.user.id)
          .single();
        if (fallback) {
          setCompanyId(fallback.company_id);
          loadUsers(fallback.company_id);
          loadPositions(fallback.company_id);
        }
      }
      setLoadingCompany(false);
    };
    init();
  }, []);

  const addUser = async () => {
    setError('');
    if (!companyId) {
      setError('Empresa não encontrada');
      return;
    }
    const res = await fetch('/api/company-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        phone,
        position: position || null,
        company_id: companyId,
      }),
    });
    if (res.ok) {
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setPosition('');
      loadUsers(companyId);
    } else {
      const { error: err } = await res.json();
      setError(err || 'Erro ao adicionar usuário');
    }
  };

  const updateUser = async (u: CompanyUser) => {
    const newName = prompt('Nome:', u.name);
    const newEmail = prompt('Email:', u.email);
    const newPhone = prompt('Telefone:', u.phone || '');
    const newPosition = prompt('Cargo:', u.position || '');
    const newPassword = prompt('Nova senha (deixe vazio para manter):');
    await fetch('/api/company-users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: u.user_id,
        name: newName || undefined,
        email: newEmail || undefined,
        phone: newPhone || undefined,
        position: newPosition || undefined,
        password: newPassword || undefined,
      }),
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
          type="text"
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded"
        />
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
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Selecione o cargo</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Button
          onClick={addUser}
          disabled={
            loadingCompany || !name || !email || !password
          }
        >
          Adicionar
        </Button>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="p-2 border-b">Nome</th>
            <th className="p-2 border-b">Email</th>
            <th className="p-2 border-b">Telefone</th>
            <th className="p-2 border-b">Cargo</th>
            <th className="p-2 border-b">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id}>
              <td className="p-2 border-b">{u.name}</td>
              <td className="p-2 border-b">{u.email}</td>
              <td className="p-2 border-b">{u.phone || '-'}</td>
              <td className="p-2 border-b">{u.position || '-'}</td>
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

