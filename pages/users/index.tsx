import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/button';
import {
  SCOPE_DEFINITIONS,
  EMPLOYEE_FIELD_OPTIONS,
} from '../../lib/access';

interface CompanyUser {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  scopes?: Record<string, any>;
  allowed_fields?: string[];
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
  const [accessUser, setAccessUser] = useState<CompanyUser | null>(null);
  const [scopeState, setScopeState] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const FIELD_OPTIONS = Object.keys(EMPLOYEE_FIELD_OPTIONS) as Array<
    keyof typeof EMPLOYEE_FIELD_OPTIONS
  >;
  type Field = (typeof FIELD_OPTIONS)[number];
  const [allowedState, setAllowedState] = useState<Field[]>([]);
  const [saving, setSaving] = useState(false);

  const loadAll = async (token: string) => {
    const res = await fetch('/api/company-users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setCompanyId(data.company_id);
      setUsers(data.users);
      setPositions(data.positions);
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
      await loadAll(session.access_token);
      setLoadingCompany(false);
    };
    init();
  }, []);

  const addUser = async () => {
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Sessão expirada');
      return;
    }
    const res = await fetch('/api/company-users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name,
        email,
        password,
        phone,
        position: position || null,
      }),
    });
    if (res.ok) {
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setPosition('');
      loadAll(session.access_token);
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch('/api/company-users', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        user_id: u.user_id,
        name: newName || undefined,
        email: newEmail || undefined,
        phone: newPhone || undefined,
        position: newPosition || undefined,
        password: newPassword || undefined,
      }),
    });
    loadAll(session.access_token);
  };

  const removeUser = async (u: CompanyUser) => {
    if (!confirm('Excluir este usuário?')) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/company-users?id=${u.user_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    loadAll(session.access_token);
  };

  const openAccessModal = (u: CompanyUser) => {
    setAccessUser(u);
    setScopeState(u.scopes || {});
    setAllowedState(
      Array.from(new Set((u.allowed_fields || []) as Field[]))
    );
  };

  function toggleAllowed(field: Field, checked: boolean) {
    setAllowedState((prev) =>
      checked ? Array.from(new Set([...prev, field])) : prev.filter((f) => f !== field)
    );
  }

  const saveAccess = async () => {
    if (!accessUser) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/company-users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: accessUser.user_id,
          scopes: scopeState,
          allowed_fields: Array.from(new Set(allowedState)),
        }),
      });
      const data = await res.json().catch(() => ({}));
      console.log('saveAccess response', res.status, data);
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar acesso');
        return;
      }
      setAllowedState((data.data?.allowed_fields || []) as Field[]);
      setAccessUser(null);
      loadAll(session.access_token);
    } finally {
      setSaving(false);
    }
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
                <Button variant="outline" onClick={() => openAccessModal(u)}>
                  Configurar acesso
                </Button>
                <Button variant="outline" onClick={() => removeUser(u)}>
                  Excluir
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {accessUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded w-full max-w-lg space-y-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold">Configurar acesso</h2>
            {Object.entries(SCOPE_DEFINITIONS).map(([mod, acts]) => (
              <div key={mod}>
                <p className="font-semibold capitalize">{mod}</p>
                {Object.entries(acts).map(([act, label]) => (
                  <label key={act} className="block ml-4">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={scopeState[mod]?.[act] || false}
                      onChange={(e) =>
                        setScopeState((prev) => ({
                          ...prev,
                          [mod]: {
                            ...prev[mod],
                            [act]: e.target.checked,
                          },
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            ))}
            <div>
              <p className="font-semibold">Campos visíveis</p>
              {Object.entries(EMPLOYEE_FIELD_OPTIONS).map(([field, label]) => (
                <label key={field} className="block ml-4">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={allowedState.includes(field as Field)}
                    onChange={(e) =>
                      toggleAllowed(field as Field, e.target.checked)
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAccessUser(null)}>
                Cancelar
              </Button>
              <Button onClick={saveAccess} disabled={saving}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

