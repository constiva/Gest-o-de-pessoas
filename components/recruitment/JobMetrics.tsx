import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ChartContainer } from '../ui/chart';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Download } from 'lucide-react';
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

const CHART_MARGIN = { left: 20, right: 20 };
const Y_AXIS_WIDTH = 140;

export default function JobMetrics({ jobId }: Props) {
  const [data, setData] = useState<
    { name: string; half: number; value: number }[]
  >([]);
  const [maxHalf, setMaxHalf] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!chartRef.current) return;
    const svg = chartRef.current.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = svg.clientWidth;
    canvas.height = svg.clientHeight;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = 'funil-de-candidatos.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  };

  useEffect(() => {
    const load = async () => {
      try {
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

        const { data: metric, error: metricError } = await supabase
          .from('job_metrics')
          .select('link_clicks')
          .eq('job_id', jobId)
          .maybeSingle();

        const clicks = metricError ? 0 : metric?.link_clicks || 0;

        const stageData = (stages || [])
          .map((s) => ({ name: s.name, value: counts[s.id] || 0 }));

        for (let i = stageData.length - 1; i >= 0; i--) {
          const next = i < stageData.length - 1 ? stageData[i + 1].value : 0;
          stageData[i].value += next;
        }

        const filteredStages = stageData.filter((d) => d.value > 0);

        const rawData = [
          { name: 'Cliques no link', value: clicks },
          ...filteredStages,
        ].filter((d) => d.value > 0);

        const chartData = rawData.map((d) => ({
          name: d.name,
          half: d.value / 2,
          value: d.value,
        }));

        setData(chartData);
        const maxVal = rawData.reduce((m, d) => Math.max(m, d.value), 0);
        setMaxHalf(maxVal / 2);
      } catch (e) {
        console.error('Failed to load job metrics', e);
      }
    };
    load();
  }, [jobId]);

  return (
    <Card className="max-w-md mx-auto">
      <div className="flex items-center justify-between p-4 pb-0">
        <h2 className="font-semibold">Funil de candidatos</h2>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <ChartContainer ref={chartRef} className="mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={CHART_MARGIN}>
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
              axisLine={false}
              tickLine={false}
              width={Y_AXIS_WIDTH}
              tick={(props) => <StageTick {...props} />}
            />
            <Tooltip content={<FunnelTooltip />} />
            <Bar
              dataKey="half"
              barSize={48}
              shape={(props) => <CenteredBar {...props} />}
            >
              <LabelList
                dataKey="value"
                content={(props) => <CenteredValue {...props} />}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </Card>
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

function CenteredValue({ value, viewBox }: any) {
  if (value == null || !viewBox) return null;
  const { x, y, height } = viewBox;
  const centerX = x;
  const centerY = y + height / 2;
  return (
    <text
      x={centerX}
      y={centerY}
      textAnchor="middle"
      dominantBaseline="middle"
      fill="white"
      className="text-xs font-medium"
    >
      {value}
    </text>
  );
}

function StageTick({ x, y, payload }: any) {
  return (
    <g transform={`translate(${x - Y_AXIS_WIDTH},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="start"
        className="text-xs font-medium fill-neutral-900"
      >
        {payload.value}
      </text>
    </g>
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
