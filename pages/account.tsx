import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface FieldPerm {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

interface Profile {
  name: string | null;
  email: string | null;
  role: string;
  allowed_fields: { [table: string]: { [field: string]: FieldPerm } };
}

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      const { data: companyUser } = await supabase
        .from('companies_users')
        .select('name,email,role,allowed_fields')
        .eq('user_id', user.id)
        .maybeSingle();
      if (companyUser) {
        setProfile({
          name: companyUser.name,
          email: companyUser.email,
          role: companyUser.role,
          allowed_fields: companyUser.allowed_fields || {},
        });
        return;
      }
      const { data: unitUser } = await supabase
        .from('companies_units')
        .select('name,email')
        .eq('user_id', user.id)
        .maybeSingle();
      if (unitUser) {
        setProfile({
          name: unitUser.name,
          email: unitUser.email,
          role: 'unit',
          allowed_fields: {},
        });
        return;
      }
      const { data: baseUser } = await supabase
        .from('users')
        .select('name,email')
        .eq('id', user.id)
        .maybeSingle();
      if (baseUser) {
        setProfile({
          name: baseUser.name,
          email: baseUser.email,
          role: 'admin',
          allowed_fields: {},
        });
      }
    }
    load();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Minha Conta</h1>
      {!profile && <p>Carregando...</p>}
      {profile && (
        <div className="space-y-2">
          <p><span className="font-medium">Nome:</span> {profile.name}</p>
          <p><span className="font-medium">Email:</span> {profile.email}</p>
          <p><span className="font-medium">Papel:</span> {profile.role}</p>
      {profile.allowed_fields &&
        Object.keys(profile.allowed_fields).length > 0 && (
          <div>
            <p className="font-medium">Permissões de campos:</p>
            {Object.entries(profile.allowed_fields).map(([table, fields]) => (
              <div key={table} className="mt-2">
                <p className="font-medium">{table}</p>
                <ul className="list-disc list-inside">
                  {Object.entries(fields as any).map(([f, perms]: any) => (
                    <li key={f}>
                      {f}: {['view', 'edit', 'delete']
                        .filter((k) => perms[k])
                        .join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        </div>
      )}
    </div>
  );
}

