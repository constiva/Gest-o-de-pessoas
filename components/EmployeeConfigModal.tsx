import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Department {
  id: string;
  name: string;
}

interface CustomField {
  id: string;
  field: string;
  value: string;
}

interface Position {
  id: string;
  name: string;
}

export default function EmployeeConfigModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<'departments' | 'positions' | 'custom'>('departments');
  const [companyId, setCompanyId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptName, setDeptName] = useState('');
  const [positions, setPositions] = useState<Position[]>([]);
  const [posName, setPosName] = useState('');
  const [fields, setFields] = useState<CustomField[]>([]);
  const [fieldName, setFieldName] = useState('');
  const [fieldValue, setFieldValue] = useState('');

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      let compId = '';
      const { data: user } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', session.user.id)
        .maybeSingle();
      if (user) {
        compId = user.company_id;
      } else {
        const { data: compUser } = await supabase
          .from('companies_users')
          .select('company_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (compUser) {
          compId = compUser.company_id;
        } else {
          const { data: unitUser } = await supabase
            .from('companies_units')
            .select('company_id')
            .eq('user_id', session.user.id)
            .maybeSingle();
          compId = unitUser?.company_id || '';
        }
      }
      setCompanyId(compId);
      const { data: deps } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', compId);
      setDepartments(deps || []);
      const { data: pos } = await supabase
        .from('positions')
        .select('*')
        .eq('company_id', compId);
      setPositions(pos || []);
      const { data: cfs } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('company_id', compId);
      setFields(cfs || []);
    };
    load();
  }, [open]);

  const addDepartment = async () => {
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

  const saveDepartment = async (dep: Department) => {
    await supabase
      .from('departments')
      .update({ name: dep.name })
      .eq('id', dep.id);
  };

  const removeDepartment = async (id: string) => {
    await supabase.from('departments').delete().eq('id', id);
    setDepartments(departments.filter((d) => d.id !== id));
  };

  const addPosition = async () => {
    const { data, error } = await supabase
      .from('positions')
      .insert({ company_id: companyId, name: posName })
      .select()
      .single();
    if (!error && data) {
      setPositions([...positions, data]);
      setPosName('');
    }
  };

  const savePosition = async (pos: Position) => {
    await supabase
      .from('positions')
      .update({ name: pos.name })
      .eq('id', pos.id);
  };

  const removePosition = async (id: string) => {
    await supabase.from('positions').delete().eq('id', id);
    setPositions(positions.filter((p) => p.id !== id));
  };

  const addField = async () => {
    const { data, error } = await supabase
      .from('custom_fields')
      .insert({ company_id: companyId, field: fieldName, value: fieldValue })
      .select()
      .single();
    if (!error && data) {
      setFields([...fields, data]);
      setFieldName('');
      setFieldValue('');
    }
  };

  const saveField = async (cf: CustomField) => {
    await supabase
      .from('custom_fields')
      .update({ field: cf.field, value: cf.value })
      .eq('id', cf.id);
  };

  const removeField = async (id: string) => {
    await supabase.from('custom_fields').delete().eq('id', id);
    setFields(fields.filter((f) => f.id !== id));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-md w-full max-w-lg max-h-[90vh] flex shadow-xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
        <aside className="w-48 border-r p-4 space-y-2 h-full overflow-y-auto">
          <button
            className={`block w-full text-left p-2 rounded ${tab === 'departments' ? 'bg-purple-100 font-semibold' : ''}`}
            onClick={() => setTab('departments')}
          >
            Departamentos
          </button>
          <button
            className={`block w-full text-left p-2 rounded ${tab === 'positions' ? 'bg-purple-100 font-semibold' : ''}`}
            onClick={() => setTab('positions')}
          >
            Cargos
          </button>
          <button
            className={`block w-full text-left p-2 rounded ${tab === 'custom' ? 'bg-purple-100 font-semibold' : ''}`}
            onClick={() => setTab('custom')}
          >
            Campos personalizados
          </button>
        </aside>
        <div className="flex-1 p-4 overflow-y-auto">
          {tab === 'departments' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Departamentos</h2>
              <div className="flex space-x-2 mb-4">
                <Input
                  placeholder="Departamento"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                />
                <Button onClick={addDepartment} disabled={!deptName} variant="outline">
                  Adicionar
                </Button>
              </div>
              {departments.map((dep) => (
                <div key={dep.id} className="flex space-x-2 mb-2">
                  <Input
                    value={dep.name}
                    onChange={(e) => (dep.name = e.target.value)}
                    onBlur={() => saveDepartment(dep)}
                  />
                  <button className="text-red-500" onClick={() => removeDepartment(dep.id)}>
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
          {tab === 'positions' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Cargos</h2>
              <div className="flex space-x-2 mb-4">
                <Input
                  placeholder="Cargo"
                  value={posName}
                  onChange={(e) => setPosName(e.target.value)}
                />
                <Button onClick={addPosition} disabled={!posName} variant="outline">
                  Adicionar
                </Button>
              </div>
              {positions.map((pos) => (
                <div key={pos.id} className="flex space-x-2 mb-2">
                  <Input
                    value={pos.name}
                    onChange={(e) => (pos.name = e.target.value)}
                    onBlur={() => savePosition(pos)}
                  />
                  <button className="text-red-500" onClick={() => removePosition(pos.id)}>
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
          {tab === 'custom' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Campos personalizados</h2>
              <div className="flex space-x-2 mb-4">
                <Input
                  placeholder="Campo"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                />
                <Input
                  placeholder="Valor"
                  value={fieldValue}
                  onChange={(e) => setFieldValue(e.target.value)}
                />
                <Button onClick={addField} disabled={!fieldName || !fieldValue} variant="outline">
                  Adicionar
                </Button>
              </div>
              {fields.map((cf) => (
                <div key={cf.id} className="flex space-x-2 mb-2">
                  <Input
                    value={cf.field}
                    onChange={(e) => (cf.field = e.target.value)}
                    onBlur={() => saveField(cf)}
                  />
                  <Input
                    value={cf.value}
                    onChange={(e) => (cf.value = e.target.value)}
                    onBlur={() => saveField(cf)}
                  />
                  <button className="text-red-500" onClick={() => removeField(cf.id)}>
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

