import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card } from '../ui/card';
import { Contact } from 'lucide-react';
import TalentModal from './TalentModal';
import { cn } from '../../lib/utils';

interface Job {
  id: string;
  title: string;
}

interface TalentItem {
  appId: string;
  id: string;
  name: string;
  jobId: string;
  jobTitle: string;
  appliedAt: string;
  status: string;
}

export default function TalentTab() {
  const [companyId, setCompanyId] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [talents, setTalents] = useState<TalentItem[]>([]);
  const [jobFilter, setJobFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [open, setOpen] = useState<{ talentId: string; appId: string } | null>(
    null
  );

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

    const { data: jobsData } = await supabase
      .from('jobs')
      .select('id,title')
      .eq('company_id', compId);
    setJobs(jobsData || []);

    const { data: appData } = await supabase
      .from('applications')
      .select(
        'id, job_id, applied_at, jobs(id,title), talent:talents(id,name,status)'
      )
      .eq('company_id', compId);
    const mapped =
      appData?.map((a: any) => ({
        appId: a.id,
        id: a.talent.id,
        name: a.talent.name,
        jobId: a.job_id,
        jobTitle: a.jobs?.title || '',
        appliedAt: a.applied_at,
        status: a.talent.status || 'active',
      })) || [];
    setTalents(mapped);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = talents.filter(
    (t) =>
      (jobFilter === 'all' || t.jobId === jobFilter) &&
      (statusFilter === 'all' || t.status === statusFilter)
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Banco de Talentos</h2>
        <select
          className="border rounded px-2 py-1"
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
        >
          <option value="all">Todas as vagas</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4 flex border-b border-gray-200">
        {[
          { value: 'all', label: 'Todas' },
          { value: 'active', label: 'Ativos' },
          { value: 'withdrawn', label: 'Desistentes' },
          { value: 'rejected', label: 'Reprovados' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium',
              statusFilter === tab.value
                ? 'border-b-2 border-brand text-brand'
                : 'text-gray-500'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((t) => (
          <Card
            key={t.appId}
            className="flex items-center gap-3 cursor-pointer p-4"
            onClick={() => setOpen({ talentId: t.id, appId: t.appId })}
          >
            <Contact className="text-purple-500" />
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-sm text-gray-500">{t.jobTitle}</div>
              <div className="text-xs text-gray-400">
                Data da inscrição: {new Date(t.appliedAt).toLocaleDateString()}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {open && (
        <TalentModal
          talentId={open.talentId}
          applicationId={open.appId}
          companyId={companyId}
          onClose={() => {
            setOpen(null);
            load();
          }}
        />
      )}
    </div>
  );
}
