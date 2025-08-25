import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ChartContainer, ChartTooltip } from '../ui/chart';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  jobId: string;
}

export default function JobMetrics({ jobId }: Props) {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: stages } = await supabase
        .from('job_stages')
        .select('id,name,position')
        .eq('job_id', jobId)
        .order('position');
      const { data: apps } = await supabase
        .from('applications')
        .select('stage_id')
        .eq('job_id', jobId);
      const counts: Record<string, number> = {};
      (apps || []).forEach((a) => {
        const key = a.stage_id || 'none';
        counts[key] = (counts[key] || 0) + 1;
      });
      const { data: metric } = await supabase
        .from('job_metrics')
        .select('link_clicks')
        .eq('job_id', jobId)
        .maybeSingle();
      const clicks = metric?.link_clicks || 0;
      const chartData = [
        { name: 'Cliques no link', value: clicks },
        ...((stages || []).map((s) => ({
          name: s.name,
          value: counts[s.id] || 0,
        }))),
      ];
      setData(chartData);
    };
    load();
  }, [jobId]);

  return (
    <ChartContainer className="max-w-md mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 40, right: 40 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" width={150} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="value" fill="#a855f7" barSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
