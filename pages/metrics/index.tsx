import { useEffect, useState, useRef } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Card } from '../../components/ui/card';
import { ChartContainer, ChartTooltip } from '../../components/ui/chart';
import { Button } from '../../components/ui/button';
import HeadcountConfigModal from '../../components/HeadcountConfigModal';
import { Settings, Download } from 'lucide-react';
import { getFieldLabel, getStatusLabel } from '../../lib/utils';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type Employee = Record<string, any>;

export type Granularity = 'day' | 'week' | 'month' | 'year';

export default function Metrics() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groupBy, setGroupBy] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [data, setData] = useState<any[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [yMax, setYMax] = useState(0);
  const [companyId, setCompanyId] = useState('');
  const [unitName, setUnitName] = useState('');
  const chartRef = useRef<HTMLDivElement>(null);
  const [turnoverData, setTurnoverData] = useState<any[]>([]);
  const [turnoverGroups, setTurnoverGroups] = useState<string[]>([]);
  const [turnoverYMax, setTurnoverYMax] = useState(0);
  const turnoverChartRef = useRef<HTMLDivElement>(null);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});
  const [genderData, setGenderData] = useState<any[]>([]);
  const [ageData, setAgeData] = useState<any[]>([]);

  useEffect(() => {
    const now = new Date();
    if (granularity === 'year') {
      setStart('');
      setEnd('');
      return;
    }
    if (granularity === 'month') {
      const year = now.getFullYear();
      setStart(`${year}-01-01`);
      setEnd(`${year}-12-31`);
    } else if (granularity === 'week') {
      const monday = new Date(now);
      const day = monday.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      monday.setDate(monday.getDate() + diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStart(monday.toISOString().slice(0, 10));
      setEnd(sunday.toISOString().slice(0, 10));
    } else {
      const endDate = now;
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 29);
      setStart(startDate.toISOString().slice(0, 10));
      setEnd(endDate.toISOString().slice(0, 10));
    }
  }, [granularity]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel('headcount-employees')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees', filter: `company_id=eq.${companyId}` },
        (payload: RealtimePostgresChangesPayload<Employee>) => {
          const newUnit = (payload.new as Employee | null)?.unit;
          const oldUnit = (payload.old as Employee | null)?.unit;
          if (!unitName || newUnit === unitName || oldUnit === unitName) {
            load();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, unitName]);

  useEffect(() => {
    buildHeadcount();
    buildTurnover();
  }, [employees, groupBy, start, end, granularity, salaryMin, salaryMax]);

  useEffect(() => {
    buildGender();
    buildAge();
  }, [employees]);

  const load = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    let companyId = '';
    let unitName = '';
    const { data: user } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', session.user.id)
      .maybeSingle();
    if (user) {
      companyId = user.company_id;
    } else {
      const { data: compUser } = await supabase
        .from('companies_users')
        .select('company_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (compUser) {
        companyId = compUser.company_id;
      } else {
        const { data: unitUser } = await supabase
          .from('companies_units')
          .select('company_id,name')
          .eq('user_id', session.user.id)
          .maybeSingle();
        companyId = unitUser?.company_id || '';
        unitName = unitUser?.name || '';
      }
    }
    if (!companyId) return;
    let query = supabase.from('employees').select('*').eq('company_id', companyId);
    if (unitName) query = query.eq('unit', unitName);
    const { data: rows } = await query;
    const expanded = (rows || []).map((emp) => ({
      ...emp,
      ...(emp.custom_fields || {}),
    }));
    setEmployees(expanded);
    const { data: cfs } = await supabase
      .from('custom_fields')
      .select('field,value')
      .eq('company_id', companyId);
    const labels: Record<string, string> = {};
    (cfs || []).forEach((cf) => {
      labels[cf.field] = cf.value;
    });
    setCustomLabels(labels);
    setCompanyId(companyId);
    setUnitName(unitName);
  };

  const parseDate = (str: string) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const isActive = (emp: Employee, date: Date) => {
    const hire = emp.hire_date ? parseDate(emp.hire_date) : null;
    const term = emp.termination_date ? parseDate(emp.termination_date) : null;
    return (!hire || hire <= date) && (!term || term > date);
  };

  const statusAt = (emp: Employee, date: Date) => {
    const hire = emp.hire_date ? parseDate(emp.hire_date) : null;
    if (hire && date < hire) return null;
    const term = emp.termination_date ? parseDate(emp.termination_date) : null;
    if (term && date >= term) return 'dismissed';
    return emp.status;
  };

  const genPeriods = (s: Date, e: Date, g: Granularity) => {
    const arr: Date[] = [];
    if (g === 'week') {
      const cur = new Date(s);
      const day = cur.getDay();
      const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
      cur.setDate(cur.getDate() + diff);
      for (let i = 0; i < 7; i++) {
        arr.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return arr;
    }
    const cur = new Date(s);
    while (cur <= e) {
      if (g === 'month') {
        const last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
        arr.push(last);
        cur.setMonth(cur.getMonth() + 1);
      } else {
        arr.push(new Date(cur));
        switch (g) {
          case 'day':
            cur.setDate(cur.getDate() + 1);
            break;
          case 'year':
            cur.setFullYear(cur.getFullYear() + 1);
            break;
        }
      }
    }
    return arr;
  };

  const fmt = (d: Date, g: Granularity) => {
    const locale = 'pt-BR';
    switch (g) {
      case 'year':
        return d.getFullYear().toString();
      case 'month':
        const short = d
          .toLocaleDateString(locale, { month: 'short' })
          .replace('.', '');
        return short.charAt(0).toUpperCase() + short.slice(1).toLowerCase();
      case 'week':
        return d
          .toLocaleDateString(locale, { weekday: 'long' })
          .replace('-feira', '')
          .replace(/^[a-z]/, (c) => c.toUpperCase());
      default:
        return d.toLocaleDateString(locale, {
          day: '2-digit',
          month: '2-digit',
        });
    }
  };

  const genRanges = (s: Date, e: Date, g: Granularity) => {
    const dates = genPeriods(s, e, g);
    return dates.map((d) => {
      let start: Date;
      if (g === 'month') {
        start = new Date(d.getFullYear(), d.getMonth(), 1);
      } else if (g === 'year') {
        start = new Date(d.getFullYear(), 0, 1);
      } else {
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }
      return { start, end: d };
    });
  };

  const buildHeadcount = () => {
    if (!employees.length) {
      setData([]);
      setYMax(0);
      return;
    }

    let emps = employees;
    if (groupBy === 'salary' && (salaryMin || salaryMax)) {
      if (salaryMin)
        emps = emps.filter((e) => Number(e.salary) >= Number(salaryMin));
      if (salaryMax)
        emps = emps.filter((e) => Number(e.salary) <= Number(salaryMax));
    }

    const hiresAll = emps
      .map((e) => (e.hire_date ? parseDate(e.hire_date) : null))
      .filter((d): d is Date => !!d);
    const today = new Date();
    const maxHire = hiresAll.length
      ? hiresAll.reduce((m, d) => (d > m ? d : m), today)
      : today;
    const limit = maxHire > today ? maxHire : today;

    let periods: Date[] = [];
    if (granularity === 'year') {
      const hires = emps
        .map((e) => (e.hire_date ? parseDate(e.hire_date) : null))
        .filter((d): d is Date => !!d);
      if (!hires.length) {
        setData([]);
        setYMax(0);
        return;
      }
      const terms = emps.map((e) =>
        e.termination_date ? parseDate(e.termination_date) : new Date()
      );
      const minYear = Math.min(...hires.map((d) => d.getFullYear()));
      const maxYear = Math.max(...terms.map((d) => d.getFullYear()));
      for (let y = minYear; y <= maxYear; y++) {
        periods.push(new Date(y, 11, 31));
      }
    } else {
      let s = start ? parseDate(start) : null;
      let e = end ? parseDate(end) : null;
      if (!s || !e) {
        if (granularity === 'month') {
          s = new Date(today.getFullYear(), 0, 1);
          e = new Date(today.getFullYear(), 11, 31);
        } else if (granularity === 'week') {
          const monday = new Date(today);
          const day = monday.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          monday.setDate(monday.getDate() + diff);
          s = monday;
          e = new Date(monday);
          e.setDate(monday.getDate() + 6);
        } else {
          e = today;
          s = new Date(today);
          s.setDate(today.getDate() - 29);
        }
      }
      if (e && e > limit) e = limit;
      if (granularity === 'week') {
        periods = genPeriods(s!, e!, granularity).filter((p) => p <= limit);
      } else {
        periods = genPeriods(s!, e!, granularity);
      }
    }

    if (groupBy) {
      const label = (
        customLabels[groupBy] || getFieldLabel(groupBy)
      ).toLowerCase();
      const missing = `Sem ${label}`;
      const gs = Array.from(
        new Set(emps.map((e) => (e[groupBy] ? e[groupBy] : missing)))
      );
      setGroups(gs);
      const rows = periods.map((p) => {
        const row: any = { period: fmt(p, granularity) };
        gs.forEach((g) => {
          const count = emps.filter((e) => {
            if (groupBy === 'status') {
              return statusAt(e, p) === g;
            }
            const val = e[groupBy] || missing;
            return val === g && isActive(e, p);
          }).length;
          row[g] = count;
        });
        return row;
      });
      setData(rows);
      const maxVal = rows.length
        ? Math.max(...rows.map((r) => Math.max(...gs.map((g) => r[g] || 0))))
        : 0;
      setYMax(maxVal);
    } else {
      const rows = periods.map((p) => ({
        period: fmt(p, granularity),
        headcount: emps.filter((e) => isActive(e, p)).length,
      }));
      setGroups([]);
      setData(rows);
      const maxVal = rows.length
        ? Math.max(...rows.map((r) => r.headcount))
        : 0;
      setYMax(maxVal);
    }
  };

  const buildTurnover = () => {
    if (!employees.length) {
      setTurnoverData([]);
      setTurnoverYMax(0);
      return;
    }
    let emps = employees;
    if (groupBy === 'salary' && (salaryMin || salaryMax)) {
      if (salaryMin)
        emps = emps.filter((e) => Number(e.salary) >= Number(salaryMin));
      if (salaryMax)
        emps = emps.filter((e) => Number(e.salary) <= Number(salaryMax));
    }
    let s = start ? parseDate(start) : null;
    let e = end ? parseDate(end) : null;
    const today = new Date();
    if (!s || !e) {
      if (granularity === 'month') {
        s = new Date(today.getFullYear(), 0, 1);
        e = new Date(today.getFullYear(), 11, 31);
      } else if (granularity === 'week') {
        const monday = new Date(today);
        const day = monday.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        monday.setDate(monday.getDate() + diff);
        s = monday;
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        e = sunday;
      } else {
        e = today;
        s = new Date(today);
        s.setDate(today.getDate() - 29);
      }
    }
    if (e > today) e = today;
    const ranges = genRanges(s!, e!, granularity);
    if (groupBy) {
      const label = (customLabels[groupBy] || getFieldLabel(groupBy)).toLowerCase();
      const missing = `Sem ${label}`;
      const gs = Array.from(
        new Set(emps.map((e) => (e[groupBy] ? e[groupBy] : missing)))
      );
      setTurnoverGroups(gs);
      const rows = ranges.map((r) => {
        const row: any = { period: fmt(r.end, granularity) };
        gs.forEach((g) => {
          const empsG = emps.filter(
            (e) => (e[groupBy] ? e[groupBy] : missing) === g
          );
          const terms = empsG.filter((e) => {
            if (e.status !== 'dismissed') return false;
            const td = e.termination_date ? parseDate(e.termination_date) : null;
            return td && td >= r.start && td <= r.end;
          }).length;
          const startHead = empsG.filter((e) => isActive(e, r.start)).length;
          const endHead = empsG.filter((e) => isActive(e, r.end)).length;
          const avg = (startHead + endHead) / 2;
          const val = avg ? (terms / avg) * 100 : 0;
          row[g] = Number(val.toFixed(2));
        });
        return row;
      });
      setTurnoverData(rows);
      const maxVal = rows.length
        ? Math.max(
            ...rows.map((r) => Math.max(...gs.map((g) => r[g] || 0)))
          )
        : 0;
      setTurnoverYMax(maxVal);
    } else {
      const rows = ranges.map((r) => {
        const terms = emps.filter((e) => {
          if (e.status !== 'dismissed') return false;
          const td = e.termination_date ? parseDate(e.termination_date) : null;
          return td && td >= r.start && td <= r.end;
        }).length;
        const startHead = emps.filter((e) => isActive(e, r.start)).length;
        const endHead = emps.filter((e) => isActive(e, r.end)).length;
        const avg = (startHead + endHead) / 2;
        const val = avg ? (terms / avg) * 100 : 0;
        return {
          period: fmt(r.end, granularity),
          turnover: Number(val.toFixed(2)),
        };
      });
      setTurnoverGroups([]);
      setTurnoverData(rows);
      const maxVal = rows.length
        ? Math.max(...rows.map((r) => r.turnover))
        : 0;
      setTurnoverYMax(maxVal);
    }
  };

  const buildGender = () => {
    if (!employees.length) {
      setGenderData([]);
      return;
    }
    const today = new Date();
    const counts: Record<string, number> = {};
    const labels: Record<string, string> = {
      male: 'Masculino',
      female: 'Feminino',
      other: 'Outro',
    };
    employees.forEach((e) => {
      if (!isActive(e, today)) return;
      const key = e.gender || 'unknown';
      const label = labels[key] || key;
      counts[label] = (counts[label] || 0) + 1;
    });
    const rows = Object.entries(counts).map(([name, value]) => ({ name, value }));
    setGenderData(rows);
  };

  const buildAge = () => {
    if (!employees.length) {
      setAgeData([]);
      return;
    }
    const today = new Date();
    const ranges = [
      { name: '18–24', min: 18, max: 24 },
      { name: '25–34', min: 25, max: 34 },
      { name: '35–44', min: 35, max: 44 },
      { name: '45–54', min: 45, max: 54 },
      { name: '55–64', min: 55, max: 64 },
      { name: '65+', min: 65, max: Infinity },
    ];
    const counts = ranges.map((r) => ({ ...r, value: 0 }));
    employees.forEach((e) => {
      if (!isActive(e, today) || !e.birth_date) return;
      const birth = new Date(e.birth_date);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      const group = counts.find((r) => age >= r.min && age <= r.max);
      if (group) group.value++;
    });
    setAgeData(counts.map(({ name, value }) => ({ name, value })));
  };

  const colors = ['#5B21B6', '#8B5CF6', '#6D28D9', '#C4B5FD', '#7E22CE', '#DDD6FE'];

  const TurnoverDot = ({ x, y, value, color }: any) => {
    if (x === undefined || y === undefined || value === undefined) return null;
    const text = `${Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
    return (
      <g>
        <circle cx={x} cy={y} r={5} fill={color} />
        <text x={x} y={y - 10} textAnchor="middle" fill={color} className="text-xs">
          {text}
        </text>
      </g>
    );
  };

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
      a.download = 'headcount.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  };

  const handleDownloadTurnover = () => {
    if (!turnoverChartRef.current) return;
    const svg = turnoverChartRef.current.querySelector('svg');
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
      a.download = 'turnover.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Métricas</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfigOpen(true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between p-4 pb-0">
            <h2 className="font-semibold">Headcount</h2>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <ChartContainer ref={chartRef} className="mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 40, left: 20, right: 20 }}>
                <XAxis
                  dataKey="period"
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, Math.max(Math.ceil(yMax * 1.1), 1)]}
                  hide
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                {groups.length
                  ? groups.map((g, i) => (
                      <Bar
                        key={g}
                        dataKey={g}
                        name={groupBy === 'status' ? getStatusLabel(g) : g}
                        fill={colors[i % colors.length]}
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList
                          dataKey={g}
                          position="top"
                          fill={colors[i % colors.length]}
                          className="text-xs"
                        />
                      </Bar>
                    ))
                  : (
                      <Bar
                        dataKey="headcount"
                        name="Headcount"
                        fill={colors[0]}
                        radius={[4, 4, 0, 0]}
                      >
                        <LabelList
                          dataKey="headcount"
                          position="top"
                          fill={colors[0]}
                          className="text-xs"
                        />
                      </Bar>
                    )}
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>
        <Card>
          <div className="flex items-center justify-between p-4 pb-0">
            <h2 className="font-semibold">Turnover</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTurnover}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <ChartContainer ref={turnoverChartRef} className="mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={turnoverData} margin={{ top: 40, left: 20, right: 20 }}>
                <XAxis
                  dataKey="period"
                  interval={0}
                  padding={{ left: 20, right: 20 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, Math.max(turnoverYMax * 1.1, 1)]}
                  hide
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                {turnoverGroups.length
                  ? turnoverGroups.map((g, i) => (
                      <Line
                        key={g}
                        type="monotone"
                        dataKey={g}
                        name={groupBy === 'status' ? getStatusLabel(g) : g}
                        stroke={colors[i % colors.length]}
                        dot={false}
                      >
                        <LabelList
                          content={(props) => (
                            <TurnoverDot
                              {...props}
                              color={colors[i % colors.length]}
                            />
                          )}
                        />
                      </Line>
                    ))
                  : (
                      <Line
                        type="monotone"
                        dataKey="turnover"
                        name="Turnover"
                        stroke={colors[0]}
                        dot={false}
                      >
                        <LabelList
                          content={(props) => (
                            <TurnoverDot {...props} color={colors[0]} />
                          )}
                        />
                      </Line>
                    )}
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between p-4 pb-0">
            <h2 className="font-semibold">Distribuição por gênero</h2>
          </div>
          <ChartContainer className="mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  labelLine={false}
                  label={({ percent }: any) => `${(percent * 100).toFixed(1)}%`}
                >
                  {genderData.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>
        <Card>
          <div className="flex items-center justify-between p-4 pb-0">
            <h2 className="font-semibold">Distribuição etária</h2>
          </div>
          <ChartContainer className="mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ageData}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={60}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="value"
                  name="Headcount"
                  fill={colors[0]}
                  radius={[0, 4, 4, 0]}
                >
                  <LabelList
                    dataKey="value"
                    position="right"
                    fill={colors[0]}
                    className="text-xs"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>
      </div>
      <HeadcountConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        start={start}
        setStart={setStart}
        end={end}
        setEnd={setEnd}
        granularity={granularity}
        setGranularity={setGranularity}
        salaryMin={salaryMin}
        setSalaryMin={setSalaryMin}
        salaryMax={salaryMax}
        setSalaryMax={setSalaryMax}
      />
    </Layout>
  );
}

