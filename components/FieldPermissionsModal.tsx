import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';
import { X } from 'lucide-react';
import Switch from './ui/switch';

interface Props {
  open: boolean;
  table: string;
  value: { [field: string]: boolean };
  onClose: () => void;
  onSave: (value: { [field: string]: boolean }) => void;
}

const fieldLabels: Record<string, string> = {
  id: 'ID',
  company_id: 'ID da empresa',
  name: 'Nome',
  email: 'E-mail',
  phone: 'Telefone',
  cpf: 'CPF',
  birth_date: 'Data de nascimento',
  street: 'Rua',
  city: 'Cidade',
  state: 'Estado',
  zip: 'CEP',
  position: 'Cargo',
  department: 'Departamento',
  unit: 'Unidade',
  salary: 'Salário',
  hire_date: 'Data de contratação',
  termination_date: 'Data de demissão',
  termination_reason: 'Motivo da demissão',
  status: 'Status',
  gender: 'Gênero',
  emergency_contact_name: 'Nome do contato de emergência',
  emergency_contact_phone: 'Telefone do contato de emergência',
  emergency_contact_relation: 'Parentesco do contato de emergência',
  resume_url: 'URL do currículo',
  comments: 'Comentários',
  custom_fields: 'Campos personalizados',
  created_at: 'Criado em',
};

export default function FieldPermissionsModal({ open, table, value, onClose, onSave }: Props) {
  const [fields, setFields] = useState<string[]>([]);
  const [perms, setPerms] = useState<{ [field: string]: boolean }>({});

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data } = await supabase.from(table).select('*').limit(1);
      const cols = data && data.length ? Object.keys(data[0]) : [];
      const init: Record<string, boolean> = {};
      cols.forEach((c) => {
        init[c] = value && typeof value[c] !== 'undefined' ? value[c] : true;
      });
      setFields(cols);
      setPerms(init);
    };
    load();
  }, [open, table, value]);

  const toggle = (field: string) => {
    setPerms({
      ...perms,
      [field]: !perms[field],
    });
  };

  const labelFor = (field: string) => fieldLabels[field] || field.replace(/_/g, ' ');

  const handleSave = () => {
    onSave(perms);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Permissões de Campos</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex-1">Campo</span>
            <span>Ativo</span>
          </div>
          {fields.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <span className="flex-1 capitalize">{labelFor(f)}</span>
              <Switch checked={perms[f]} onChange={() => toggle(f)} />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
