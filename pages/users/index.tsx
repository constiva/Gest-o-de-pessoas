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
  role: string;
  scopes: { [key: string]: boolean };
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
  const [search, setSearch] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingUnit, setCreatingUnit] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState('viewer');
  const [scopes, setScopes] = useState<{ [key: string]: boolean }>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [unitEditingId, setUnitEditingId] = useState<string | null>(null);

  const scopeLabels: Record<string, string> = {
    employees: 'Funcionários',
    metrics: 'Métricas',
    recruitment: 'R&S',
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gestor',
    recruiter: 'Recrutador',
    viewer: 'Visualizador',
  };

  const formatScopes = (s: { [key: string]: boolean }) =>
    Object.keys(s || {})
      .filter((k) => s[k])
      .map((k) => scopeLabels[k] || k)
      .join(', ');

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const compId =
        (session.user as any)?.user_metadata?.company_id ||
        (session.user as any)?.app_metadata?.company_id;
      if (!compId) return;

      setCompanyId(compId);

      const { data: posData } = await supabase
        .from('positions')
        .select('name')
        .eq('company_id', compId);
      setPositions(posData?.map((p: any) => p.name) || []);

      const { data: companyUsers } = await supabase
        .from('companies_users')
        .select('user_id,name,email,phone,position,role,scopes')
        .eq('company_id', compId);
      setUsers(companyUsers || []);

      const { data: companyUnits } = await supabase
        .from('companies_units')
        .select('user_id,name,email,phone')
        .eq('company_id', compId);
      setUnits(companyUnits || []);
    };
    load();
  }, []);

  const startCreateUser = () => {
    setCreatingUser(true);
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setPosition('');
    setRole('viewer');
    setScopes({});
  };

  const closeUserForm = () => {
    setCreatingUser(false);
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setPosition('');
    setRole('viewer');
    setScopes({});
  };

  const startCreateUnit = () => {
    setCreatingUnit(true);
    setUnitEditingId(null);
    setUName('');
    setUEmail('');
    setUPhone('');
    setUPassword('');
  };

  const closeUnitForm = () => {
    setCreatingUnit(false);
    setUnitEditingId(null);
    setUName('');
    setUEmail('');
    setUPhone('');
    setUPassword('');
  };

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
        role,
        scopes,
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
      closeUserForm();
    }
  };

  const startEdit = (u: CompanyUser) => {
    setCreatingUser(false);
    setEditingId(u.user_id);
    setName(u.name);
    setEmail(u.email);
    setPhone(u.phone);
    setPosition(u.position || '');
    setRole(u.role || 'viewer');
    setScopes(u.scopes || {});
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
      if (editingId === user_id) {
        closeUserForm();
      }
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
      closeUnitForm();
    }
  };

  const startEditUnit = (u: CompanyUnit) => {
    setCreatingUnit(false);
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
      if (unitEditingId === user_id) {
        closeUnitForm();
      }
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );
  const filteredUnits = units.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">Usuários & Permissões</h1>

        <div className="mb-4 border-b flex">
          <button
            className={`px-4 py-2 -mb-px ${tab === 'users' ? 'border-b-2 border-black' : 'text-gray-500'}`}
            onClick={() => {
              setTab('users');
              setSearch('');
              setCreatingUser(false);
              setCreatingUnit(false);
              setEditingId(null);
              setUnitEditingId(null);
            }}
          >
            Usuários
          </button>
          <button
            className={`px-4 py-2 -mb-px ${tab === 'units' ? 'border-b-2 border-black' : 'text-gray-500'}`}
            onClick={() => {
              setTab('units');
              setSearch('');
              setCreatingUser(false);
              setCreatingUnit(false);
              setEditingId(null);
              setUnitEditingId(null);
            }}
          >
            Unidades
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Pesquisar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button onClick={tab === 'users' ? startCreateUser : startCreateUnit}>
            {tab === 'users' ? 'Criar usuário' : 'Criar unidade'}
          </Button>
        </div>

        {tab === 'users' ? (
          <div className="flex gap-4">
            <div className="w-1/3 space-y-2">
              {filteredUsers.map((u) => (
                <div
                  key={u.user_id}
                  onClick={() => startEdit(u)}
                  className={`border p-2 rounded cursor-pointer ${
                    editingId === u.user_id && !creatingUser ? 'bg-gray-100' : ''
                  }`}
                >
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-sm text-gray-600">{u.email}</div>
                  <div className="text-xs text-gray-500">
                    {formatScopes(u.scopes)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-1">
              {(creatingUser || editingId) && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                  <select
                    className="border p-2 rounded w-full"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="admin">Administrador</option>
                    <option value="manager">Gestor</option>
                    <option value="recruiter">Recrutador</option>
                    <option value="viewer">Visualizador</option>
                  </select>
                  <div className="sm:col-span-2 lg:col-span-3 flex gap-4">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={scopes.employees || false}
                        onChange={(e) => setScopes({ ...scopes, employees: e.target.checked })}
                      />
                      Funcionários
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={scopes.metrics || false}
                        onChange={(e) => setScopes({ ...scopes, metrics: e.target.checked })}
                      />
                      Métricas
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={scopes.recruitment || false}
                        onChange={(e) =>
                          setScopes({ ...scopes, recruitment: e.target.checked })
                        }
                      />
                      R&S
                    </label>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                    <Button onClick={saveUser} disabled={!name || !email || (!password && !editingId)}>
                      {editingId ? 'Salvar' : 'Adicionar'}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeUserForm}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            <div className="w-1/3 space-y-2">
              {filteredUnits.map((u) => (
                <div
                  key={u.user_id}
                  onClick={() => startEditUnit(u)}
                  className={`border p-2 rounded cursor-pointer ${
                    unitEditingId === u.user_id && !creatingUnit ? 'bg-gray-100' : ''
                  }`}
                >
                  <div className="font-semibold">{u.name}</div>
                  <div className="text-sm text-gray-600">{u.email}</div>
                </div>
              ))}
            </div>
            <div className="flex-1">
              {(creatingUnit || unitEditingId) && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                    <Button type="button" variant="outline" onClick={closeUnitForm}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
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
