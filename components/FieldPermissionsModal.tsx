import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  table: string;
  value: { [field: string]: { view: boolean; edit: boolean } };
  onClose: () => void;
  onSave: (value: { [field: string]: { view: boolean; edit: boolean } }) => void;
}

export default function FieldPermissionsModal({ open, table, value, onClose, onSave }: Props) {
  const [fields, setFields] = useState<string[]>([]);
  const [perms, setPerms] = useState<{ [field: string]: { view: boolean; edit: boolean } }>(value || {});

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data } = await supabase.from(table).select('*').limit(1);
      const cols = data && data.length ? Object.keys(data[0]) : [];
      const init: any = {};
      cols.forEach((c) => {
        init[c] = perms[c] || { view: true, edit: false };
      });
      setFields(cols);
      setPerms(init);
    };
    load();
  }, [open, table]);

  const toggle = (field: string, key: 'view' | 'edit') => {
    setPerms({
      ...perms,
      [field]: { ...perms[field], [key]: !perms[field][key] },
    });
  };

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
          {fields.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <span className="flex-1 capitalize">{f.replace(/_/g, ' ')}</span>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={perms[f]?.view}
                  onChange={() => toggle(f, 'view')}
                />
                Ver
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={perms[f]?.edit}
                  onChange={() => toggle(f, 'edit')}
                />
                Editar
              </label>
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
