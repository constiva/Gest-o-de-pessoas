import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';
import { FIELD_GROUPS, getFieldLabel } from '../lib/utils';

const ACTIONS = [
  { key: 'view', label: 'Visualizar' },
  { key: 'create', label: 'Criar' },
  { key: 'edit', label: 'Editar' },
  { key: 'activate', label: 'Ativar' },
  { key: 'inactivate', label: 'Inativar' },
  { key: 'dismiss', label: 'Desligar' },
  { key: 'delete', label: 'Excluir' },
];


export default function UsersPermissions() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [actionPerms, setActionPerms] = useState<Record<string, boolean>>(
    ACTIONS.reduce((acc, a) => ({ ...acc, [a.key]: false }), {})
  );
  const [fieldSelections, setFieldSelections] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<string[]>([]);

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
      const { data: defs } = await supabase
        .from('custom_fields')
        .select('field')
        .eq('company_id', cid);
      setCustomFields(defs ? defs.map((d: any) => d.field) : []);

      setLoading(false);
    };
    init();
  }, [router]);

  const reloadUsers = async (cid: string) => {
    const { data: companyUsers } = await supabase
      .from('companies_users')
      .select('user_id, role')
      .eq('company_id', cid);

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

  const toggleAction = (key: string) => {
    setActionPerms((a) => ({ ...a, [key]: !a[key] }));
  };

  const toggleField = (f: string) => {
    setFieldSelections((fs) =>
      fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f]
    );
  };

  const addUser = async () => {
    if (!companyId) return;
    const res = await fetch('/api/subaccounts/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: newPassword }),
    });
    const { id } = await res.json();
    await supabase.from('companies_users').insert({
      company_id: companyId,
      user_id: id,
      role: newRole,
      scopes: { employees: actionPerms },
      allowed_fields: fieldSelections,
    });
    setNewEmail('');
    setNewPassword('');
    setActionPerms(ACTIONS.reduce((acc, a) => ({ ...acc, [a.key]: false }), {}));
    setFieldSelections([]);
    await reloadUsers(companyId);
  };


  if (loading) return <p>Carregando...</p>;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">Usuários & Permissões</h1>
      <div className="mb-6">
        <input
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="E-mail"
          className="border p-2 mr-2"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Senha temporária"
          className="border p-2 mr-2"
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          className="border p-2 mr-2"
        >
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
        <Button onClick={addUser} disabled={!newEmail || !newPassword}>
          Adicionar
        </Button>
      </div>
      <div className="mb-6">
        <div className="mb-2 font-semibold">Ações permitidas</div>
        <div className="space-x-4">
          {ACTIONS.map((a) => (
            <label key={a.key} className="mr-4">
              <input
                type="checkbox"
                checked={actionPerms[a.key]}
                onChange={() => toggleAction(a.key)}
                className="mr-1"
              />
              {a.label}
            </label>
          ))}
        </div>
      </div>
      <div className="mb-6">
        <div className="mb-2 font-semibold">Campos visíveis</div>
        {FIELD_GROUPS.map((g) => (
          <div key={g.title} className="mb-2">
            <div className="font-medium">{g.title}</div>
            <div className="ml-2 space-x-4">
              {g.fields.map((f) => (
                <label key={f} className="mr-4">
                  <input
                    type="checkbox"
                    checked={fieldSelections.includes(f)}
                    onChange={() => toggleField(f)}
                    className="mr-1"
                  />
                  {getFieldLabel(f)}
                </label>
              ))}
            </div>
          </div>
        ))}
        {customFields.length > 0 && (
          <div className="mb-2">
            <div className="font-medium">Personalizados</div>
            <div className="ml-2 space-x-4">
              {customFields.map((f) => (
                <label key={f} className="mr-4">
                  <input
                    type="checkbox"
                    checked={fieldSelections.includes(f)}
                    onChange={() => toggleField(f)}
                    className="mr-1"
                  />
                  {getFieldLabel(f)}
                </label>
              ))}
            </div>
          </div>
        )}
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
