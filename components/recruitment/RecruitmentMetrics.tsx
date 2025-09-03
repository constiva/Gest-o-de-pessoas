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

const CHART_MARGIN = { left: 20, right: 20 };
const Y_AXIS_WIDTH = 180;
const SOURCE_COLORS = [
  '#3f0071',
  '#5a189a',
  '#7b2cbf',
  '#9d4edd',
  '#c77dff',
  '#e0aaff',
  '#f3e8ff',
  '#f8f0ff',
];

export default function RecruitmentMetrics() {
  const [data, setData] = useState<{ name: string; half: number; value: number }[]>([]);
  const [maxHalf, setMaxHalf] = useState(0);
  const [closingTime, setClosingTime] = useState<number | null>(null);
  const [stageDurations, setStageDurations] = useState<{ name: string; avg: number; sla: number | null }[]>([]);
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const companyId =
          (session.user as any)?.user_metadata?.company_id ||
          (session.user as any)?.app_metadata?.company_id;
        if (!companyId) return;

        const { data: jobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('company_id', companyId);
        const jobIds = (jobs || []).map((j) => j.id);
        if (!jobIds.length) return;

        const { data: stages } = await supabase
          .from('job_stages')
          .select('id,job_id,name,position,sla_days')
          .in('job_id', jobIds);

        const stageMap = new Map(
          (stages || []).map((s) => [s.id, { name: s.name, position: s.position, sla: s.sla_days }])
        );

        const stageOrder: Record<string, number> = {};
        (stages || []).forEach((s) => {
          const existing = stageOrder[s.name];
          if (existing === undefined || s.position < existing) stageOrder[s.name] = s.position;
        });

        const { data: apps } = await supabase
          .from('applications')
          .select('id,stage_id,job_id,talent:talents(source)')
          .in('job_id', jobIds);

        const countsByName: Record<string, number> = {};
        const sourceCounts: Record<string, number> = {};
        (apps || []).forEach((a: any) => {
          const info = stageMap.get(a.stage_id);
          const name = info?.name || 'Etapa';
          countsByName[name] = (countsByName[name] || 0) + 1;
          const src = a.talent?.source || 'other';
          sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        });

        const appIds = (apps || []).map((a) => a.id);
        const { data: dateRows } = await supabase
          .from('application_stage_dates')
          .select('application_id,stage_id,day_in,day_out')
          .in('application_id', appIds);

        const statsByName: Record<string, { name: string; total: number; count: number; slaHits: number; slaTotal: number; sla: number | null; position: number }> = {};
        (dateRows || []).forEach((r: any) => {
          if (!r.day_in) return;
          const info = stageMap.get(r.stage_id);
          const name = info?.name || 'Etapa';
          const position = info?.position || 0;
          const sla = info?.sla ?? null;
          const start = new Date(r.day_in).getTime();
          const end = r.day_out ? new Date(r.day_out).getTime() : Date.now();
          const duration = (end - start) / 86400000;
          const st =
            statsByName[name] ||
            { name, total: 0, count: 0, slaHits: 0, slaTotal: 0, sla, position };
          st.total += duration;
          st.count++;
          if (sla) {
            st.slaTotal++;
            if (duration <= sla) st.slaHits++;
          }
          statsByName[name] = st;
        });

        const durationArr = Object.values(statsByName)
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            name: s.name,
            avg: s.count ? s.total / s.count : 0,
            sla: s.sla ? (s.slaTotal ? (s.slaHits / s.slaTotal) * 100 : 0) : null,
          }));
        setStageDurations(durationArr);

        const totalSources = Object.values(sourceCounts).reduce((sum, c) => sum + c, 0);
        setSourceData(
          Object.entries(sourceCounts).map(([src, count]) => ({
            name: getSourceLabel(src),
            value: totalSources ? (count / totalSources) * 100 : 0,
          }))
        );

        const stageNames = Object.keys(stageOrder).sort((a, b) => stageOrder[a] - stageOrder[b]);
        const stageData = stageNames.map((name) => ({ name, value: countsByName[name] || 0 }));
        for (let i = stageData.length - 1; i >= 0; i--) {
          const next = i < stageData.length - 1 ? stageData[i + 1].value : 0;
          stageData[i].value += next;
        }

        const { data: metricsRows } = await supabase
          .from('job_metrics')
          .select('link_clicks,closing_time')
          .in('job_id', jobIds);
        let clicks = 0;
        let closingSum = 0;
        let closingCount = 0;
        (metricsRows || []).forEach((m: any) => {
          clicks += m.link_clicks || 0;
          if (m.closing_time != null) {
            closingSum += m.closing_time;
            closingCount++;
          }
        });
        setClosingTime(closingCount ? closingSum / closingCount : null);

        const rawData = [{ name: 'Cliques no link', value: clicks }, ...stageData].filter((d) => d.value > 0);
        const chartData = rawData.map((d) => ({ name: d.name, half: d.value / 2, value: d.value }));
        setData(chartData);
        const maxVal = rawData.reduce((m, d) => Math.max(m, d.value), 0);
        setMaxHalf(maxVal / 2);
      } catch (e) {
        console.error('Failed to load metrics', e);
      }
    };
    load();
  }, []);

  const radarData = stageDurations.map((s) => ({ stage: s.name, value: s.avg }));
  const maxAvg = radarData.reduce((m, d) => Math.max(m, d.value), 0);

  return (
    <section className="grid gap-4 md:grid-cols-2 md:grid-rows-2">
      <Card className="h-full">
        <div className="flex items-center justify-between p-4 pb-0">
          <h2 className="font-semibold">Funil de candidatos</h2>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
        <div ref={chartRef} className="p-4">
          {data.length ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} layout="vertical" margin={CHART_MARGIN}>
                  <XAxis type="number" hide domain={[-maxHalf, maxHalf]} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={Y_AXIS_WIDTH}
                    tick={(props) => <StageTick {...props} />}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={false} />
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
            </>
          ) : (
            <p className="text-sm text-center">Sem dados</p>
          )}
        </div>
      </Card>
      <Card className="h-full">
        <div className="flex items-center justify-between p-4 pb-0">
          <h2 className="font-semibold">Origem dos talentos</h2>
          <Button variant="outline" size="sm" onClick={handleDownloadPie}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
        <div ref={pieRef} className="p-4">
          {sourceData.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  dataKey="value"
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
                    const radius = innerRadius + (outerRadius - innerRadius) / 2;
                    const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
                    const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="#fff"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={12}
                      >
                        {`${value.toFixed(0)}%`}
                      </text>
                    );
                  }}
                >
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-center">Sem dados</p>
          )}
        </div>
      </Card>
      <Card className="h-full md:col-span-2">
        <div className="p-4">
          <h2 className="font-semibold mb-4">Tempo</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <div className="p-4">
                <h3 className="font-medium">Tempo de fechamento da vaga</h3>
                {closingTime !== null ? (
                  <p className="text-2xl font-semibold text-center">{formatDuration(closingTime)}</p>
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
                  className="mx-auto aspect-square max-h-[350px] p-4"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      outerRadius={120}
                      data={radarData}
                      margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
                    >
                      <PolarGrid />
                      <PolarAngleAxis
                        dataKey="stage"
                        tick={({ x, y, payload, ...rest }: any) => {
                          const angle = (payload.index / radarData.length) * 2 * Math.PI - Math.PI / 2;
                          const offsetX = Math.cos(angle) * 20;
                          const offsetY = Math.sin(angle) * 20;
                          return (
                            <text x={x + offsetX} y={y + offsetY} textAnchor="middle" fontSize={12} {...rest}>
                              <tspan>{payload.value}</tspan>
                              <tspan x={x + offsetX} dy="1rem" fontSize={12} className="fill-muted-foreground">
                                {formatDuration(radarData[payload.index].value)}
                              </tspan>
                            </text>
                          );
                        }}
                      />
                      <PolarRadiusAxis angle={30} domain={[0, maxAvg || 1]} tick={false} />
                      <Radar dataKey="value" stroke="#9d4edd" fill="#9d4edd" fillOpacity={0.6} />
                    </RadarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <p className="text-sm text-center p-4">Sem dados</p>
              )}
            </Card>
          </div>
        </div>
      </Card>
    </section>
  );
}

function formatDuration(days: number) {
  const d = Math.floor(days);
  const h = Math.round((days - d) * 24);
  const parts = [] as string[];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  return parts.join(' ') || '0h';
}

function CenteredBar({ x, y, width, height }: any) {
  return (
    <rect
      x={x - width}
      y={y}
      width={width * 2}
      height={height}
      fill="#9d4edd"
      rx={4}
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

