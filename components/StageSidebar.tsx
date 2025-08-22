import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Stage {
  id: string;
  name: string;
  position: number;
  sla_days: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function StageSidebar({ open, onClose }: Props) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [sla, setSla] = useState('');

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const compId =
        (session.user as any)?.app_metadata?.company_id ||
        (session.user as any)?.user_metadata?.company_id || '';
      if (!compId) return;
      setCompanyId(compId);
      const { data } = await supabase
        .from('job_stages')
        .select('id,name,position,sla_days')
        .eq('company_id', compId)
        .is('job_id', null)
        .order('position');
      setStages(data || []);
    };
    load();
  }, [open]);

  const add = async () => {
    const { data, error } = await supabase
      .from('job_stages')
      .insert({
        company_id: companyId,
        name,
        position: stages.length + 1,
        sla_days: sla ? Number(sla) : null,
      })
      .select('id,name,position,sla_days')
      .single();
    if (!error && data) {
      setStages([...stages, data]);
      setName('');
      setSla('');
    }
  };

  const save = async (stage: Stage) => {
    await supabase
      .from('job_stages')
      .update({ name: stage.name, position: stage.position, sla_days: stage.sla_days })
      .eq('id', stage.id);
  };

  const remove = async (id: string) => {
    await supabase.from('job_stages').delete().eq('id', id);
    setStages(stages.filter((s) => s.id !== id));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative bg-white w-96 h-full p-4 overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Etapas</h2>
          <button onClick={onClose}>X</button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Input
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="col-span-2"
          />
          <Input
            placeholder="SLA"
            type="number"
            value={sla}
            onChange={(e) => setSla(e.target.value)}
          />
          <div className="col-span-3 flex justify-end">
            <Button onClick={add} disabled={!name} variant="outline">
              Adicionar
            </Button>
          </div>
        </div>
        {stages.map((st) => (
          <div key={st.id} className="grid grid-cols-6 gap-2 mb-2 items-center">
            <Input
              value={st.position}
              type="number"
              onChange={(e) => (st.position = Number(e.target.value))}
              onBlur={() => save(st)}
              className="col-span-1"
            />
            <Input
              value={st.name}
              onChange={(e) => (st.name = e.target.value)}
              onBlur={() => save(st)}
              className="col-span-3"
            />
            <Input
              value={st.sla_days ?? ''}
              type="number"
              onChange={(e) => (st.sla_days = e.target.value ? Number(e.target.value) : null)}
              onBlur={() => save(st)}
              className="col-span-1"
            />
            <Button variant="outline" size="icon" onClick={() => remove(st.id)}>
              x
            </Button>
          </div>
        ))}
      </aside>
    </div>
  );
}

