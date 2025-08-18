import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import { Card } from '../../components/ui/card';
import { ChartContainer, ChartTooltip } from '../../components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type Employee = {
  department?: string;
  unit?: string;
  hire_date?: string;
  termination_date?: string;
};

type Granularity = 'day' | 'week' | 'month' | 'year';
type Group = 'none' | 'department' | 'unit';

export default function Headcount() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groupBy, setGroupBy] = useState<Group>('department');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [data, setData] = useState<any[]>([]);
  const [groups, setGroups] = useState<string[]>([]);

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
    build();
  }, [employees, groupBy, start, end, granularity]);

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
  };

  const isActive = (emp: Employee, date: Date) => {
    const hire = emp.hire_date ? new Date(emp.hire_date) : null;
    const term = emp.termination_date ? new Date(emp.termination_date) : null;
    return (!hire || hire <= date) && (!term || term > date);
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
      arr.push(new Date(cur));
      switch (g) {
        case 'day':
          cur.setDate(cur.getDate() + 1);
          break;
        case 'month':
          cur.setMonth(cur.getMonth() + 1);
          break;
        case 'year':
          cur.setFullYear(cur.getFullYear() + 1);
          break;
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
      return;
    }

    let periods: Date[] = [];
    if (granularity === 'year') {
      const hires = employees
        .map((e) => (e.hire_date ? new Date(e.hire_date) : null))
        .filter((d): d is Date => !!d);
      if (!hires.length) {
        setData([]);
        return;
      }
      const terms = employees.map((e) =>
        e.termination_date ? new Date(e.termination_date) : new Date()
      );
      const minYear = Math.min(...hires.map((d) => d.getFullYear()));
      const maxYear = Math.max(...terms.map((d) => d.getFullYear()));
      for (let y = minYear; y <= maxYear; y++) {
        periods.push(new Date(y, 11, 31));
      }
    } else {
      let s = start ? new Date(start) : null;
      let e = end ? new Date(end) : null;
      if (!s || !e) {
        const now = new Date();
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
      periods = genPeriods(s!, e!, granularity);
    }

    if (groupBy === 'department') {
      const deps = Array.from(
        new Set(employees.map((e) => e.department || 'Sem departamento'))
      );
      setGroups(deps);
      const rows = periods.map((p) => {
        const row: any = { period: fmt(p, granularity) };
        deps.forEach((d) => {
          row[d] = employees.filter(
            (e) => (e.department || 'Sem departamento') === d && isActive(e, p)
          ).length;
        });
        return row;
      });
      setData(
        granularity === 'year'
          ? rows.filter((r) => deps.some((d) => r[d] > 0))
          : rows
      );
    } else if (groupBy === 'unit') {
      const uns = Array.from(
        new Set(employees.map((e) => e.unit || 'Sem filial'))
      );
      setGroups(uns);
      const rows = periods.map((p) => {
        const row: any = { period: fmt(p, granularity) };
        uns.forEach((u) => {
          row[u] = employees.filter(
            (e) => (e.unit || 'Sem filial') === u && isActive(e, p)
          ).length;
        });
        return row;
      });
      setData(
        granularity === 'year'
          ? rows.filter((r) => uns.some((u) => r[u] > 0))
          : rows
      );
    } else {
      const rows = periods.map((p) => ({
        period: fmt(p, granularity),
        count: employees.filter((e) => isActive(e, p)).length,
      }));
      setGroups([]);
      setData(
        granularity === 'year' ? rows.filter((r) => r.count > 0) : rows
      );
    }
  };

  const colors = ['#6D28D9', '#A78BFA', '#C4B5FD', '#DDD6FE', '#8B5CF6', '#7C3AED'];

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-6">Headcount</h1>
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Agrupar por</label>
          <select
            className="border border-gray-300 rounded-md p-2 text-sm dark:bg-gray-800 dark:border-gray-700"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as Group)}
          >
            <option value="department">Departamento</option>
            <option value="unit">Filial</option>
            <option value="none">Nenhum</option>
          </select>
        </div>
        {granularity !== 'year' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Início</label>
              <input
                type="date"
                className="border border-gray-300 rounded-md p-2 text-sm dark:bg-gray-800 dark:border-gray-700"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fim</label>
              <input
                type="date"
                className="border border-gray-300 rounded-md p-2 text-sm dark:bg-gray-800 dark:border-gray-700"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Granularidade</label>
          <select
            className="border border-gray-300 rounded-md p-2 text-sm dark:bg-gray-800 dark:border-gray-700"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
          >
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
            <option value="year">Ano</option>
          </select>
        </div>
      </div>
      <Card>
        <ChartContainer>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis allowDecimals={false} />
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
                    <Bar
                      dataKey="count"
                      fill={colors[0]}
                    />
                  )}
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </Card>
    </Layout>
  );
}

