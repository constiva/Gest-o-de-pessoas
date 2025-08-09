import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Department {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DepartmentSidebar({ open, onClose }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');

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
        .from('departments')
        .select('*')
        .eq('company_id', user.company_id);
      setDepartments(data || []);
    };
    load();
  }, [open]);

  const add = async () => {
    const { data, error } = await supabase
      .from('departments')
      .insert({ company_id: companyId, name })
      .select()
      .single();
    if (!error && data) {
      setDepartments([...departments, data]);
      setName('');
    }
  };

  const save = async (dep: Department) => {
    await supabase
      .from('departments')
      .update({ name: dep.name })
      .eq('id', dep.id);
  };

  const remove = async (id: string) => {
    await supabase.from('departments').delete().eq('id', id);
    setDepartments(departments.filter((d) => d.id !== id));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative bg-white w-80 h-full p-4 overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Departamentos</h2>
          <button onClick={onClose}>X</button>
        </div>
        <div className="flex space-x-2 mb-4">
          <Input
            placeholder="Departamento"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={add} disabled={!name} variant="outline">
            Adicionar
          </Button>
        </div>
        {departments.map((dep) => (
          <div key={dep.id} className="flex space-x-2 mb-2">
            <Input
              value={dep.name}
              onChange={(e) => (dep.name = e.target.value)}
              onBlur={() => save(dep)}
            />
            <button className="text-red-500" onClick={() => remove(dep.id)}>
              x
            </button>
          </div>
        ))}
      </aside>
    </div>
  );
}
