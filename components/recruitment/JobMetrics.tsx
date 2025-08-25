import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ChartContainer } from '../ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

interface Props {
  jobId: string;
}

export default function JobMetrics({ jobId }: Props) {
  const [data, setData] = useState<
    { name: string; half: number; value: number }[]
  >([]);
  const [maxHalf, setMaxHalf] = useState(0);

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
      const rawData = [
        { name: 'Cliques no link', value: clicks },
        ...((stages || []).map((s) => ({
          name: s.name,
          value: counts[s.id] || 0,
        }))),
      ];
      const chartData = rawData.map((d) => ({
        name: d.name,
        half: d.value / 2,
        value: d.value,
      }));
      setData(chartData);
      const maxVal = rawData.reduce((m, d) => Math.max(m, d.value), 0);
      setMaxHalf(maxVal / 2);
    };
    load();
  }, [jobId]);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h3 className="text-lg font-semibold text-center">Funil de candidatos</h3>
      <ChartContainer>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 40, right: 40 }}>
            <XAxis
              type="number"
              domain={[-maxHalf, maxHalf]}
              hide
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={150}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<FunnelTooltip />} />
            <Bar
              dataKey="half"
              barSize={24}
              shape={(props) => <CenteredBar {...props} />}
            >
              <LabelList
                dataKey="value"
                content={(props) => <CenteredLabel {...props} />}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

function CenteredBar({ x, y, width, height }: any) {
  const halfWidth = width;
  return (
    <rect
      x={x - halfWidth}
      y={y}
      width={halfWidth * 2}
      height={height}
      fill="#a855f7"
      rx={2}
      ry={2}
    />
  );
}

function CenteredLabel({ x, y, height, value }: any) {
  return (
    <text
      x={x}
      y={y + height / 2}
      textAnchor="middle"
      dominantBaseline="middle"
      fill="white"
      className="text-xs"
    >
      {value}
    </text>
  );
}

function FunnelTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0].payload.value;
  return (
    <div className="rounded-md border bg-white px-2 py-1 text-xs shadow-sm">
      <p className="font-medium mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#a855f7' }} />
        <span>{value}</span>
      </div>
    </div>
  );
}
