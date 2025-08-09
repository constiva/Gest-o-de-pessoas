import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';

interface CustomField {
  id: string;
  field: string;
  value: string;
}

interface Department {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function EmployeeConfigModal({ open, onClose }: Props) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [companyId, setCompanyId] = useState<string>('');
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptName, setDeptName] = useState('');

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
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
  }, [open]);

  if (!open) return null;

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Configurações</h2>
          <button onClick={onClose}>X</button>
        </div>
        <h3 className="font-semibold mb-2">Campos Personalizados</h3>
        <div className="space-x-2 mb-4">
          <input
            className="border p-1"
            placeholder="Campo"
            value={field}
            onChange={(e) => setField(e.target.value)}
          />
          <input
            className="border p-1"
            placeholder="Valor"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button onClick={add} disabled={!field || !value} variant="outline">
            Adicionar
          </Button>
        </div>
        {fields.map((cf) => (
          <div key={cf.id} className="mb-2 space-x-2">
            <input
              className="border p-1"
              value={cf.field}
              onChange={(e) => (cf.field = e.target.value)}
              onBlur={() => save(cf)}
            />
            <input
              className="border p-1"
              value={cf.value}
              onChange={(e) => (cf.value = e.target.value)}
              onBlur={() => save(cf)}
            />
            <button className="text-red-500" onClick={() => remove(cf.id)}>
              x
            </button>
          </div>
        ))}
        <hr className="my-4" />
        <h3 className="font-semibold mb-2">Departamentos</h3>
        <div className="space-x-2 mb-4">
          <input
            className="border p-1"
            placeholder="Departamento"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
          />
          <Button onClick={addDept} disabled={!deptName} variant="outline">
            Adicionar
          </Button>
        </div>
        {departments.map((dep) => (
          <div key={dep.id} className="mb-2 space-x-2">
            <input
              className="border p-1"
              value={dep.name}
              onChange={(e) => (dep.name = e.target.value)}
              onBlur={() => saveDept(dep)}
            />
            <button className="text-red-500" onClick={() => removeDept(dep.id)}>
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
