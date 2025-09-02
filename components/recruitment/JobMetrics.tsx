import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ChartContainer, ChartTooltip } from '../ui/chart';
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { getSourceLabel } from '../../lib/utils';

interface Props {
  jobId: string;
}

const CHART_MARGIN = { left: 20, right: 20 };
const Y_AXIS_WIDTH = 180;
// Distinct purple palette ranging from very dark to ultra light
// to give clearer contrast between pie slices
const SOURCE_COLORS = [
  '#3f0071', // very dark purple
  '#5a189a', // dark purple
  '#7b2cbf', // medium purple
  '#9d4edd', // bright purple
  '#c77dff', // light purple
  '#e0aaff', // very light purple
  '#f3e8ff', // ultra light purple
  '#f8f0ff', // near-white purple
];

export default function JobMetrics({ jobId }: Props) {
  const [data, setData] = useState<
    { name: string; half: number; value: number }[]
  >([]);
  const [maxHalf, setMaxHalf] = useState(0);
  const [closingTime, setClosingTime] = useState<number | null>(null);
  const [stageDurations, setStageDurations] = useState<
    { name: string; avg: number; sla: number | null }[]
  >([]);
  const [sourceData, setSourceData] = useState<{ name: string; value: number }[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);

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

  const handleDownloadRadar = () => {
    if (!radarRef.current) return;
    const svg = radarRef.current.querySelector('svg');
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
      a.download = 'tempo-medio-etapas.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  };

  const handleDownloadPie = () => {
    if (!pieRef.current) return;
    const svg = pieRef.current.querySelector('svg');
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
      a.download = 'origem-dos-talentos.png';
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
          .select('id,name,position,sla_days')
          .eq('job_id', jobId)
          .order('position');

        const { data: apps } = await supabase
          .from('applications')
          .select('id,stage_id,applied_at,talent:talents(source)')
          .eq('job_id', jobId);

        const counts: Record<string, number> = {};
        const sourceCounts: Record<string, number> = {};
        (apps || []).forEach((a: any) => {
          const keyStage = a.stage_id || 'none';
          counts[keyStage] = (counts[keyStage] || 0) + 1;
          const src = a.talent?.source || 'other';
          sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        });

        const appIds = (apps || []).map((a) => a.id);
        const { data: dateRows } = await supabase
          .from('application_stage_dates')
          .select('application_id,stage_id,day_in,day_out')
          .in('application_id', appIds);

        const stageMap = new Map(
          (stages || []).map((s) => [s.id, { name: s.name, sla: s.sla_days }])
        );
        const datesByApp: Record<string, any[]> = {};
        (dateRows || []).forEach((d) => {
          if (!datesByApp[d.application_id]) datesByApp[d.application_id] = [];
          datesByApp[d.application_id].push(d);
        });

        const stats: Record<string, { total: number; count: number; slaHits: number; slaTotal: number }> = {};
        Object.values(datesByApp).forEach((records) => {
          records.forEach((r: any) => {
            if (!r.day_in) return;
            const start = new Date(r.day_in).getTime();
            const end = r.day_out ? new Date(r.day_out).getTime() : Date.now();
            const duration = (end - start) / 86400000;
            const st = stats[r.stage_id] || {
              total: 0,
              count: 0,
              slaHits: 0,
              slaTotal: 0,
            };
            st.total += duration;
            st.count++;
            const sla = stageMap.get(r.stage_id)?.sla;
            if (sla) {
              st.slaTotal++;
              if (duration <= sla) st.slaHits++;
            }
            stats[r.stage_id] = st;
          });
        });

        const { data: metric, error: metricError } = await supabase
          .from('job_metrics')
          .select('link_clicks,closing_time')
          .eq('job_id', jobId)
          .maybeSingle();

        const clicks = metricError ? 0 : metric?.link_clicks || 0;
        setClosingTime(metric?.closing_time ?? null);
        const durationArr = Object.entries(stats).map(([id, s]) => {
          const info = stageMap.get(id);
          const hasSla = info?.sla != null;
          return {
            name: info?.name || 'Etapa',
            avg: s.count ? s.total / s.count : 0,
            sla: hasSla ? (s.slaTotal ? (s.slaHits / s.slaTotal) * 100 : 0) : null,
          };
        });
        setStageDurations(durationArr);
        const totalSources = Object.values(sourceCounts).reduce(
          (sum, c) => sum + c,
          0
        );
        setSourceData(
          Object.entries(sourceCounts).map(([src, count]) => ({
            name: getSourceLabel(src),
            value: totalSources ? (count / totalSources) * 100 : 0,
          }))
        );

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

  const radarData = stageDurations.map((s) => ({ stage: s.name, value: s.avg }));
  const maxAvg = radarData.reduce((m, d) => Math.max(m, d.value), 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
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
      <Card>
        <div className="p-4">
          <h2 className="font-semibold mb-4">Tempo</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <div className="p-4">
                <h3 className="font-medium">Tempo de fechamento da vaga</h3>
                {closingTime !== null ? (
                  <p className="text-2xl font-semibold text-center">
                    {formatDuration(closingTime)}
                  </p>
                ) : (
                  <p className="text-sm text-center">Sem dados</p>
                )}
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <h3 className="font-medium">SLA compliance</h3>
                {stageDurations.filter((s) => s.sla !== null).length ? (
                  <ul className="ml-4 list-disc text-sm">
                    {stageDurations
                      .filter((s) => s.sla !== null)
                      .map((s) => (
                        <li key={s.name}>{`${s.name}: ${s.sla!.toFixed(0)}%`}</li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-sm">Sem dados</p>
                )}
              </div>
            </Card>
            <Card className="md:col-span-2">
              <div className="flex items-center justify-between p-4 pb-0">
                <h3 className="font-medium">Tempo médio em cada etapa</h3>
                <Button variant="outline" size="sm" onClick={handleDownloadRadar}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              {radarData.length ? (
                <ChartContainer
                  ref={radarRef}
                  className="mx-auto aspect-square max-h-[350px] mt-4"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      data={radarData}
                      outerRadius={120}
                      margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
                    >
                      <PolarGrid />
                      <PolarAngleAxis
                        dataKey="stage"
                        tick={({ x, y, payload, cx, cy, index }: any) => {
                          const d = radarData.find((r) => r.stage === payload.value);
                          const dx = x - cx;
                          const dy = y - cy;
                          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                          const offset = 30;
                          const newX = cx + (dx / dist) * (dist + offset);
                          const newY = cy + (dy / dist) * (dist + offset);
                          return (
                            <text
                              x={newX}
                              y={newY}
                              textAnchor="middle"
                              fontSize={12}
                              fontWeight={500}
                            >
                              <tspan x={newX}>{payload.value}</tspan>
                              <tspan
                                x={newX}
                                dy="1rem"
                                fontSize={12}
                                className="fill-muted-foreground"
                              >
                                {d ? formatDuration(d.value) : ''}
                              </tspan>
                            </text>
                          );
                        }}
                      />
                      <PolarRadiusAxis domain={[0, maxAvg]} tick={false} />
                      <Radar
                        dataKey="value"
                        stroke="#a855f7"
                        fill="#a855f7"
                        fillOpacity={0.6}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <p className="text-sm text-center">Sem dados</p>
              )}
            </Card>
          </div>
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between p-4 pb-0">
          <h2 className="font-semibold">Origem dos talentos</h2>
          <Button variant="outline" size="sm" onClick={handleDownloadPie}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
        {sourceData.length ? (
          <ChartContainer ref={pieRef} className="mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  labelLine={false}
                  label={({ value }: any) => `${value.toFixed(1)}%`}
                >
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <p className="text-sm text-center mt-4">Sem dados</p>
        )}
      </Card>
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
    <text
      x={x - 16}
      y={y}
      dy={4}
      textAnchor="end"
      className="text-xs font-medium fill-neutral-900"
    >
      {payload.value}
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

function formatDuration(value: number) {
  const days = Math.floor(value);
  const hours = Math.round((value - days) * 24);
  const dayStr = days > 0 ? `${days}d` : '';
  const hourStr = hours > 0 ? `${hours}h` : '';
  return dayStr || hourStr ? [dayStr, hourStr].filter(Boolean).join(' ') : '0h';
}
