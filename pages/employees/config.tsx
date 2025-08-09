import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

interface CustomField {
  id: string;
  field: string;
  value: string;
}

interface Department {
  id: string;
  name: string;
}

export default function EmployeesConfig() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [companyId, setCompanyId] = useState<string>('');
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptName, setDeptName] = useState('');
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const { data: user } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', session.user.id)
        .single();
      setCompanyId(user.company_id);
      const { data } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('company_id', user.company_id);
      setFields(data || []);
      const { data: deps } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', user.company_id);
      setDepartments(deps || []);
    };
    load();
  }, [router]);

  const add = async () => {
    const { data, error } = await supabase
      .from('custom_fields')
      .insert({ company_id: companyId, field, value })
      .select()
      .single();
    if (!error && data) {
      setFields([...fields, data]);
      setField('');
      setValue('');
    }
  };

  const save = async (cf: CustomField) => {
    await supabase
      .from('custom_fields')
      .update({ field: cf.field, value: cf.value })
      .eq('id', cf.id);
  };

  const remove = async (id: string) => {
    await supabase.from('custom_fields').delete().eq('id', id);
    setFields(fields.filter((f) => f.id !== id));
  };

  const addDept = async () => {
    const { data, error } = await supabase
      .from('departments')
      .insert({ company_id: companyId, name: deptName })
      .select()
      .single();
    if (!error && data) {
      setDepartments([...departments, data]);
      setDeptName('');
    }
  };

  const saveDept = async (dep: Department) => {
    await supabase
      .from('departments')
      .update({ name: dep.name })
      .eq('id', dep.id);
  };

  const removeDept = async (id: string) => {
    await supabase.from('departments').delete().eq('id', id);
    setDepartments(departments.filter((d) => d.id !== id));
  };

  return (
    <div>
      <h1>Campos Personalizados</h1>
      <div>
        <input
          placeholder="Campo"
          value={field}
          onChange={(e) => setField(e.target.value)}
        />
        <input
          placeholder="Valor"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button onClick={add} disabled={!field || !value}>
          Adicionar
        </button>
      </div>
      <table border="1" cellPadding="4">
        <thead>
          <tr>
            <th>Campo</th>
            <th>Valor</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((cf) => (
            <tr key={cf.id}>
              <td>
                <input
                  value={cf.field}
                  onChange={(e) =>
                    setFields(fields.map((f) => (f.id === cf.id ? { ...f, field: e.target.value } : f)))
                  }
                />
              </td>
              <td>
                <input
                  value={cf.value}
                  onChange={(e) =>
                    setFields(fields.map((f) => (f.id === cf.id ? { ...f, value: e.target.value } : f)))
                  }
                />
              </td>
              <td>
                <button onClick={() => save(cf)}>Salvar</button>
                <button onClick={() => remove(cf.id)}>Excluir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h1>Departamentos</h1>
      <div>
        <input
          placeholder="Nome"
          value={deptName}
          onChange={(e) => setDeptName(e.target.value)}
        />
        <button onClick={addDept} disabled={!deptName}>
          Adicionar
        </button>
      </div>
      <table border="1" cellPadding="4">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {departments.map((d) => (
            <tr key={d.id}>
              <td>
                <input
                  value={d.name}
                  onChange={(e) =>
                    setDepartments(departments.map((dep) => (dep.id === d.id ? { ...dep, name: e.target.value } : dep)))
                  }
                />
              </td>
              <td>
                <button onClick={() => saveDept(d)}>Salvar</button>
                <button onClick={() => removeDept(d.id)}>Excluir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
