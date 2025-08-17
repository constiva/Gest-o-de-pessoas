import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import PositionSidebar from '../../components/PositionSidebar';

interface CompanyUser {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  position: string | null;
}

export default function CompanyUsersPage() {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const [posOpen, setPosOpen] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [position, setPosition] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: user } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', session.user.id)
        .single();
      if (!user) return;
      setCompanyId(user.company_id);
      const { data: posData } = await supabase
        .from('positions')
        .select('name')
        .eq('company_id', user.company_id);
      setPositions(posData?.map((p: any) => p.name) || []);
      const { data: companyUsers } = await supabase
        .from('companies_users')
        .select('user_id,name,email,phone,position')
        .eq('company_id', user.company_id);
      setUsers(companyUsers || []);
    };
    load();
  }, []);

  const addUser = async () => {
    const res = await fetch('/api/company-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name,
        phone,
        position,
        company_id: companyId,
      }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      setUsers([...users, data.user]);
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setPosition('');
    }
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">Usuários & Permissões</h1>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          <Input
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            placeholder="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <select
              className="border p-2 rounded w-full"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="">Cargo</option>
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => setPosOpen(true)}>
              Cargos
            </Button>
          </div>
          <Button className="sm:col-span-2 lg:col-span-3" onClick={addUser} disabled={!name || !email || !password}>
            Adicionar
          </Button>
        </div>
        <table className="w-full text-left border">
          <thead>
            <tr className="border-b">
              <th className="p-2">Nome</th>
              <th className="p-2">Email</th>
              <th className="p-2">Telefone</th>
              <th className="p-2">Cargo</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className="border-b">
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.phone}</td>
                <td className="p-2">{u.position}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PositionSidebar
        open={posOpen}
        onClose={() => {
          setPosOpen(false);
          supabase
            .from('positions')
            .select('name')
            .eq('company_id', companyId)
            .then(({ data }) => setPositions(data?.map((p: any) => p.name) || []));
        }}
      />
    </Layout>
  );
}
