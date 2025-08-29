import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card } from '../ui/card';
import { Contact } from 'lucide-react';
import TalentModal from './TalentModal';

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
}

export default function TalentTab() {
  const [companyId, setCompanyId] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [talents, setTalents] = useState<TalentItem[]>([]);
  const [jobFilter, setJobFilter] = useState('all');
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
      .select('id, job_id, jobs(id,title), talent:talents(id,name)')
      .eq('company_id', compId);
    const mapped =
      appData?.map((a: any) => ({
        appId: a.id,
        id: a.talent.id,
        name: a.talent.name,
        jobId: a.job_id,
        jobTitle: a.jobs?.title || '',
      })) || [];
    setTalents(mapped);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = talents.filter(
    (t) => jobFilter === 'all' || t.jobId === jobFilter
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
