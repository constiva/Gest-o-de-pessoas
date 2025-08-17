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

interface CompanyUnit {
  user_id: string;
  name: string;
  email: string;
  phone: string;
}

export default function CompanyUsersPage() {
  const [tab, setTab] = useState<'users' | 'units'>('users');
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [units, setUnits] = useState<CompanyUnit[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const [posOpen, setPosOpen] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [position, setPosition] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [unitEditingId, setUnitEditingId] = useState<string | null>(null);

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
      const { data: companyUnits } = await supabase
        .from('companies_units')
        .select('user_id,name,email,phone')
        .eq('company_id', user.company_id);
      setUnits(companyUnits || []);
    };
    load();
  }, []);

  const saveUser = async () => {
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch('/api/company-users', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: editingId,
        email,
        password: password || undefined,
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
      if (editingId) {
        setUsers(users.map((u) => (u.user_id === editingId ? data.user : u)));
      } else {
        setUsers([...users, data.user]);
      }
      setEditingId(null);
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setPosition('');
    }
  };

  const startEdit = (u: CompanyUser) => {
    setEditingId(u.user_id);
    setName(u.name);
    setEmail(u.email);
    setPhone(u.phone);
    setPosition(u.position || '');
  };

  const deleteUser = async (user_id: string) => {
    if (!confirm('Excluir este usuário?')) return;
    const res = await fetch('/api/company-users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, company_id: companyId }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      setUsers(users.filter((u) => u.user_id !== user_id));
    }
  };

  const saveUnit = async () => {
    const method = unitEditingId ? 'PUT' : 'POST';
    const res = await fetch('/api/company-units', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: unitEditingId,
        email: uEmail,
        password: uPassword || undefined,
        name: uName,
        phone: uPhone,
        company_id: companyId,
      }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      if (unitEditingId) {
        setUnits(units.map((u) => (u.user_id === unitEditingId ? data.user : u)));
      } else {
        setUnits([...units, data.user]);
      }
      setUnitEditingId(null);
      setUName('');
      setUEmail('');
      setUPhone('');
      setUPassword('');
    }
  };

  const startEditUnit = (u: CompanyUnit) => {
    setUnitEditingId(u.user_id);
    setUName(u.name);
    setUEmail(u.email);
    setUPhone(u.phone);
  };

  const deleteUnit = async (user_id: string) => {
    if (!confirm('Excluir esta unidade?')) return;
    const res = await fetch('/api/company-units', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, company_id: companyId }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      setUnits(units.filter((u) => u.user_id !== user_id));
    }
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">Usuários & Permissões</h1>
        <div className="mb-4 flex gap-2">
          <Button variant={tab === 'users' ? 'default' : 'outline'} onClick={() => setTab('users')}>
            Usuários
          </Button>
          <Button variant={tab === 'units' ? 'default' : 'outline'} onClick={() => setTab('units')}>
            Unidades
          </Button>
        </div>
        {tab === 'users' ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-4">
              <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
              <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                <Button onClick={saveUser} disabled={!name || !email || (!password && !editingId)}>
                  {editingId ? 'Salvar' : 'Adicionar'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setName('');
                      setEmail('');
                      setPhone('');
                      setPassword('');
                      setPosition('');
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
            <table className="w-full text-left border">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Nome</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Telefone</th>
                  <th className="p-2">Cargo</th>
                  <th className="p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} className="border-b">
                    <td className="p-2">{u.name}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{u.phone}</td>
                    <td className="p-2">{u.position}</td>
                    <td className="p-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(u)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteUser(u.user_id)}>
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-4">
              <Input placeholder="Nome" value={uName} onChange={(e) => setUName(e.target.value)} />
              <Input placeholder="Email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} />
              <Input placeholder="Telefone" value={uPhone} onChange={(e) => setUPhone(e.target.value)} />
              <Input
                placeholder="Senha"
                type="password"
                value={uPassword}
                onChange={(e) => setUPassword(e.target.value)}
              />
              <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                <Button onClick={saveUnit} disabled={!uName || !uEmail || (!uPassword && !unitEditingId)}>
                  {unitEditingId ? 'Salvar' : 'Adicionar'}
                </Button>
                {unitEditingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setUnitEditingId(null);
                      setUName('');
                      setUEmail('');
                      setUPhone('');
                      setUPassword('');
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
            <table className="w-full text-left border">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Nome</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Telefone</th>
                  <th className="p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.user_id} className="border-b">
                    <td className="p-2">{u.name}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{u.phone}</td>
                    <td className="p-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEditUnit(u)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteUnit(u.user_id)}>
                        Excluir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
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
