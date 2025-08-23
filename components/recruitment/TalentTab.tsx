import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import StageSidebar from '../StageSidebar';

interface Stage {
  id: string;
  name: string;
  position: number;
}

interface Talent {
  id: string;
  name: string;
  stage_id: string | null;
}

const DEFAULT_STAGES = [
  { name: 'Listados', position: 1, sla_days: 2 },
  { name: 'Triagem Curricular', position: 2, sla_days: 3 },
  { name: 'Triagem Técnica', position: 3, sla_days: 5 },
  { name: 'Entrevista Final', position: 4, sla_days: 7 },
  { name: 'Oferta', position: 5, sla_days: 2 },
  { name: 'Admitido', position: 6, sla_days: null },
];

export default function TalentTab() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [talents, setTalents] = useState<Talent[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [stageOpen, setStageOpen] = useState(false);
  const [companyId, setCompanyId] = useState('');

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
    let { data: stagesData } = await supabase
      .from('job_stages')
      .select('id,name,position')
      .eq('company_id', compId)
      .is('job_id', null)
      .order('position');
    if (!stagesData || stagesData.length === 0) {
      const { data } = await supabase
        .from('job_stages')
        .insert(
          DEFAULT_STAGES.map((s) => ({ ...s, company_id: compId }))
        )
        .select('id,name,position');
      stagesData = data || [];
    }
    setStages(stagesData || []);
    const { data: talentsData } = await supabase
      .from('talents')
      .select('id,name,stage_id')
      .eq('company_id', compId);
    setTalents(talentsData || []);
  };

  useEffect(() => {
    load();
  }, []);

  const onDrop = async (stageId: string) => {
    if (!dragId) return;
    await supabase.from('talents').update({ stage_id: stageId }).eq('id', dragId);
    setTalents((prev) => prev.map((t) => (t.id === dragId ? { ...t, stage_id: stageId } : t)));
    setDragId(null);
  };

  const grouped = stages.map((s) => ({
    stage: s,
    items: talents.filter((t) => t.stage_id === s.id),
  }));

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <h2 className="text-xl font-semibold">Banco de Talentos</h2>
        <Button variant="outline" onClick={() => setStageOpen(true)}>
          Etapas
        </Button>
      </div>
      <div className="flex gap-4 overflow-x-auto">
        {grouped.map(({ stage, items }) => (
          <div
            key={stage.id}
            className="w-64 bg-gray-100 rounded p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(stage.id)}
          >
            <h3 className="font-medium mb-2">{stage.name}</h3>
            {items.map((talent) => (
              <div
                key={talent.id}
                className="bg-white rounded shadow p-2 mb-2 cursor-move"
                draggable
                onDragStart={() => setDragId(talent.id)}
              >
                {talent.name}
              </div>
            ))}
          </div>
        ))}
      </div>
      <StageSidebar
        open={stageOpen}
        onClose={() => {
          setStageOpen(false);
          load();
        }}
      />
    </div>
  );
}

