import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface CustomField {
  id: string;
  field: string;
  value: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CustomFieldSidebar({ open, onClose }: Props) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [field, setField] = useState('');
  const [value, setValue] = useState('');

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
      const { data } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('company_id', compId);
      setFields(data || []);
    };
    load();
  }, [open]);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative bg-white w-80 h-full p-4 overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Campos personalizados</h2>
          <button onClick={onClose}>X</button>
        </div>
        <div className="flex space-x-2 mb-4">
          <Input
            placeholder="Campo"
            value={field}
            onChange={(e) => setField(e.target.value)}
          />
          <Input
            placeholder="Valor"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button onClick={add} disabled={!field || !value} variant="outline">
            Adicionar
          </Button>
        </div>
        {fields.map((cf) => (
          <div key={cf.id} className="flex space-x-2 mb-2">
            <Input
              value={cf.field}
              onChange={(e) => (cf.field = e.target.value)}
              onBlur={() => save(cf)}
            />
            <Input
              value={cf.value}
              onChange={(e) => (cf.value = e.target.value)}
              onBlur={() => save(cf)}
            />
            <button className="text-red-500" onClick={() => remove(cf.id)}>
              x
            </button>
          </div>
        ))}
      </aside>
    </div>
  );
}
