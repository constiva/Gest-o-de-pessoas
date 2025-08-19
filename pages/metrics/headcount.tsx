import { useEffect, useState, useRef } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import { Card } from '../../components/ui/card';
import { ChartContainer, ChartTooltip } from '../../components/ui/chart';
import { Button } from '../../components/ui/button';
import HeadcountConfigModal from '../../components/HeadcountConfigModal';
import { Settings, Download } from 'lucide-react';
import { getFieldLabel } from '../../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type Employee = Record<string, any>;

export type Granularity = 'day' | 'week' | 'month' | 'year';

export default function Headcount() {
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
        (payload) => {
          if (
            !unitName ||
            payload.new?.unit === unitName ||
            payload.old?.unit === unitName
          ) {
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
    build();
  }, [employees, groupBy, start, end, granularity, salaryMin, salaryMax]);

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
    setEmployees(rows || []);
    setCompanyId(companyId);
    setUnitName(unitName);
  };

  const isActive = (emp: Employee, date: Date) => {
    const hire = emp.hire_date ? new Date(emp.hire_date) : null;
    const term = emp.termination_date ? new Date(emp.termination_date) : null;
    return (!hire || hire <= date) && (!term || term > date);
  };

  const parseDate = (str: string) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
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
        return d
          .toLocaleDateString(locale, { month: 'long' })
          .replace(/^[a-z]/, (c) => c.toUpperCase());
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

  const build = () => {
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

    let periods: Date[] = [];
    if (granularity === 'year') {
      const hires = emps
        .map((e) => (e.hire_date ? new Date(e.hire_date) : null))
        .filter((d): d is Date => !!d);
      if (!hires.length) {
        setData([]);
        setYMax(0);
        return;
      }
      const terms = emps.map((e) =>
        e.termination_date ? new Date(e.termination_date) : new Date()
      );
      const minYear = Math.min(...hires.map((d) => d.getFullYear()));
      const maxYear = Math.max(...terms.map((d) => d.getFullYear()));
      for (let y = minYear; y <= maxYear; y++) {
        periods.push(new Date(y, 11, 31));
      }
    } else {
      let s = start ? parseDate(start) : null;
      let e = end ? parseDate(end) : null;
      const now = new Date();
      if (!s || !e) {
        if (granularity === 'month') {
          s = new Date(now.getFullYear(), 0, 1);
          e = new Date(now.getFullYear(), 11, 31);
        } else if (granularity === 'week') {
          const monday = new Date(now);
          const day = monday.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          monday.setDate(monday.getDate() + diff);
          s = monday;
          e = new Date(monday);
          e.setDate(monday.getDate() + 6);
        } else {
          e = now;
          s = new Date(now);
          s.setDate(now.getDate() - 29);
        }
      }
      if (e && e > now) e = now;
      if (granularity === 'week') {
        periods = genPeriods(s!, e!, granularity).filter((p) => p <= now);
      } else {
        periods = genPeriods(s!, e!, granularity);
      }
    }

    if (groupBy) {
      const label = getFieldLabel(groupBy).toLowerCase();
      const missing = `Sem ${label}`;
      const gs = Array.from(new Set(emps.map((e) => e[groupBy] || missing)));
      setGroups(gs);
      const rows = periods.map((p) => {
        const row: any = { period: fmt(p, granularity) };
        gs.forEach((g) => {
          row[g] = emps.filter(
            (e) => (e[groupBy] || missing) === g && isActive(e, p)
          ).length;
        });
        return row;
      });
      const filtered =
        granularity === 'year'
          ? rows.filter((r) => gs.some((g) => r[g] > 0))
          : rows;
      setData(filtered);
      const maxVal = filtered.length
        ? Math.max(
            ...filtered.map((r) => Math.max(...gs.map((g) => r[g] || 0)))
          )
        : 0;
      setYMax(maxVal);
    } else {
      const rows = periods.map((p) => ({
        period: fmt(p, granularity),
        headcount: emps.filter((e) => isActive(e, p)).length,
      }));
      setGroups([]);
      const filtered =
        granularity === 'year' ? rows.filter((r) => r.headcount > 0) : rows;
      setData(filtered);
      const maxVal = filtered.length
        ? Math.max(...filtered.map((r) => r.headcount))
        : 0;
      setYMax(maxVal);
    }
  };

  const colors = ['#6D28D9', '#A78BFA', '#C4B5FD', '#DDD6FE', '#8B5CF6', '#7C3AED'];

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

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Headcount</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Card>
        <ChartContainer ref={chartRef}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="period" />
              <YAxis allowDecimals={false} domain={[0, yMax || 1]} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              {groups.length
                ? groups.map((g, i) => (
                    <Bar
                      key={g}
                      dataKey={g}
                      fill={colors[i % colors.length]}
                    />
                  ))
                : (
                    <Bar dataKey="headcount" name="Headcount" fill={colors[0]} />
                  )}
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </Card>
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

