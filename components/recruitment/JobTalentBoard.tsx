import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import StageSidebar from '../StageSidebar';
import TalentModal from './TalentModal';
import { getSourceLabel } from '../../lib/utils';
import { Clock } from 'lucide-react';

interface Stage {
  id: string;
  name: string;
  position: number;
}

interface Tag {
  name: string;
  color: string;
}

interface ApplicationItem {
  id: string; // application id
  talent_id: string;
  name: string;
  stage_id: string | null;
  created_at: string;
  source: string | null;
  tags: Tag[];
}

const DEFAULT_STAGES = [
  { name: 'Listados', position: 1, sla_days: 2 },
  { name: 'Triagem Curricular', position: 2, sla_days: 3 },
  { name: 'Triagem Técnica', position: 3, sla_days: 5 },
  { name: 'Entrevista Final', position: 4, sla_days: 7 },
  { name: 'Oferta', position: 5, sla_days: 2 },
  { name: 'Admitido', position: 6, sla_days: null },
];

interface Props {
  jobId: string;
}

export default function JobTalentBoard({ jobId }: Props) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [stageOpen, setStageOpen] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [active, setActive] = useState<{
    talentId: string;
    appId: string;
  } | null>(null);

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
      .eq('job_id', jobId)
      .order('position');
    if (!stagesData || stagesData.length === 0) {
      const { data } = await supabase
        .from('job_stages')
        .insert(
          DEFAULT_STAGES.map((s) => ({ ...s, company_id: compId, job_id: jobId }))
        )
        .select('id,name,position');
      stagesData = data || [];
    }
    setStages(stagesData || []);
    const { data: appData } = await supabase
      .from('applications')
      .select(
        'id,stage_id,talent:talents(id,name,created_at,source,talent_tag_map(tag:talent_tags(name,color)))'
      )
      .eq('company_id', compId)
      .eq('job_id', jobId);
    const mapped =
      appData?.map((a: any) => ({
        id: a.id,
        talent_id: a.talent.id,
        name: a.talent.name,
        stage_id: a.stage_id,
        created_at: a.talent.created_at,
        source: a.talent.source || null,
        tags:
          a.talent.talent_tag_map?.map((m: any) => ({
            name: m.tag.name,
            color: m.tag.color || '#a855f7',
          })) || [],
      })) || [];
    setItems(mapped);
  };

  useEffect(() => {
    load();
  }, [jobId]);

  const onDrop = async (stageId: string) => {
    if (!dragId) return;
    console.log('[JobTalentBoard] updating application', {
      id: dragId,
      stage: stageId,
    });
    const { data, error } = await supabase
      .from('applications')
      .update({ stage_id: stageId })
      .eq('id', dragId)
      .select();
    if (error) {
      console.error('[JobTalentBoard] update failed', error);
      alert(error.message);
    } else {
      console.log('[JobTalentBoard] update success', data);
      setItems((prev) =>
        prev.map((t) => (t.id === dragId ? { ...t, stage_id: stageId } : t)),
      );
    }
    setDragId(null);
  };

  const timeSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}d`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours}h`;
  };

  const grouped = stages.map((s) => ({
    stage: s,
    items: items.filter((t) => t.stage_id === s.id),
  }));

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <h2 className="text-xl font-semibold">Talentos</h2>
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
            {items.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded shadow p-2 mb-2 cursor-move"
                draggable
                onDragStart={() => setDragId(t.id)}
              >
                <div className="flex justify-between text-xs text-gray-500">
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {timeSince(t.created_at)}
                  </span>
                  {t.source && <span>{getSourceLabel(t.source)}</span>}
                </div>
                <button
                  className="mt-1 block font-medium hover:underline text-left"
                  onClick={() =>
                    setActive({ talentId: t.talent_id, appId: t.id })
                  }
                >
                  {t.name}
                </button>
                {t.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(() => {
                      const MAX = 2;
                      const shown = t.tags.slice(0, MAX);
                      const extra = t.tags.length - shown.length;
                      return (
                        <>
                          {shown.map((tag) => (
                            <span
                              key={tag.name}
                              className="px-2 py-0.5 rounded text-xs"
                              style={{
                                color: tag.color,
                                backgroundColor: `${tag.color}33`,
                                fontWeight: 'bold',
                              }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {extra > 0 && (
                            <span className="px-2 py-0.5 rounded bg-gray-200 text-xs">+{extra}</span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {active && (
        <TalentModal
          talentId={active.talentId}
          applicationId={active.appId}
          companyId={companyId}
          onClose={() => {
            setActive(null);
            load();
          }}
        />
      )}
      <StageSidebar
        open={stageOpen}
        onClose={() => {
          setStageOpen(false);
          load();
        }}
        jobId={jobId}
      />
    </div>
  );
}
