import { useEffect, useState } from 'react';
import { GripVertical } from 'lucide-react';
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
  jobId?: string;
}

export default function StageSidebar({ open, onClose, jobId }: Props) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [sla, setSla] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

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
      const query = supabase
        .from('job_stages')
        .select('id,name,position,sla_days')
        .eq('company_id', compId)
        .order('position');
      if (jobId) query.eq('job_id', jobId); else query.is('job_id', null);
      const { data } = await query;
      setStages(data || []);
    };
    load();
  }, [open]);

  const persistOrder = async (list: Stage[]) => {
    const ordered = list.map((s, i) => ({ ...s, position: i + 1 }));
    setStages(ordered);
    console.log('persistOrder start ->', ordered.map(({ id, position }) => ({ id, position })));
    try {
      // First move everything to a unique negative position to avoid conflicts
      for (const { id, position } of ordered) {
        const tempPos = -(position + 1000);
        const { error } = await supabase
          .from('job_stages')
          .update({ position: tempPos })
          .eq('id', id);
        console.log('temp update', { id, tempPos, error });
      }

      // Then apply the final sequential positions
      for (const { id, position } of ordered) {
        const { error } = await supabase
          .from('job_stages')
          .update({ position })
          .eq('id', id);
        console.log('final update', { id, position, error });
      }
    } catch (err) {
      console.error('persistOrder failed', err);
    }
  };

  const add = async () => {
    const nextPos = stages.reduce((max, s) => Math.max(max, s.position), 0) + 1;
    const { data, error } = await supabase
      .from('job_stages')
      .insert({
        company_id: companyId,
        job_id: jobId ?? null,
        name,
        position: nextPos,
        sla_days: sla ? Number(sla) : null,
      })
      .select('id,name,position,sla_days')
      .single();
    if (!error && data) {
      await persistOrder([...stages, data]);
      setName('');
      setSla('');
    }
  };

  const save = async (stage: Stage) => {
    await supabase
      .from('job_stages')
      .update({ name: stage.name, sla_days: stage.sla_days })
      .eq('id', stage.id);
  };

  const remove = async (id: string) => {
    await supabase.from('job_stages').delete().eq('id', id);
    await persistOrder(stages.filter((s) => s.id !== id));
  };

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...stages];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setDragIndex(index);
    setStages(updated);
  };

  const handleDragEnd = () => {
    if (dragIndex === null) return;
    console.log('handleDragEnd ->', stages.map(({ id, position }) => ({ id, position })));
    persistOrder(stages);
    setDragIndex(null);
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
        {stages.map((st, i) => (
          <div
            key={st.id}
            className="grid grid-cols-6 gap-2 mb-2 items-center cursor-move"
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(i, e)}
            onDragEnd={handleDragEnd}
          >
            <GripVertical className="col-span-1 h-4 w-4 justify-self-center" />
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

