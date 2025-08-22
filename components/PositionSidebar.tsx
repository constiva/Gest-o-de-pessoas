import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Position {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PositionSidebar({ open, onClose }: Props) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');

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
        .from('positions')
        .select('*')
        .eq('company_id', compId);
      setPositions(data || []);
    };
    load();
  }, [open]);

  const add = async () => {
    const { data, error } = await supabase
      .from('positions')
      .insert({ company_id: companyId, name })
      .select()
      .single();
    if (!error && data) {
      setPositions([...positions, data]);
      setName('');
    }
  };

  const save = async (pos: Position) => {
    await supabase
      .from('positions')
      .update({ name: pos.name })
      .eq('id', pos.id);
  };

  const remove = async (id: string) => {
    await supabase.from('positions').delete().eq('id', id);
    setPositions(positions.filter((p) => p.id !== id));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative bg-white w-80 h-full p-4 overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Cargos</h2>
          <button onClick={onClose}>X</button>
        </div>
        <div className="flex space-x-2 mb-4">
          <Input
            placeholder="Cargo"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={add} disabled={!name} variant="outline">
            Adicionar
          </Button>
        </div>
        {positions.map((pos) => (
          <div key={pos.id} className="flex space-x-2 mb-2">
            <Input
              value={pos.name}
              onChange={(e) => (pos.name = e.target.value)}
              onBlur={() => save(pos)}
            />
            <button className="text-red-500" onClick={() => remove(pos.id)}>
              x
            </button>
          </div>
        ))}
      </aside>
    </div>
  );
}
