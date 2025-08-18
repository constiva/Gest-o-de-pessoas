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
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      const periods = genPeriods(s, e, granularity);
      if (groupBy === 'department') {
        const deps = Array.from(
          new Set(employees.map((e) => e.department || 'Sem departamento'))
        );
        setGroups(deps);
        const rows = periods.map((p) => {
          const row: any = { period: fmt(p, granularity) };
          deps.forEach((d) => {
            row[d] = employees.filter(
              (e) =>
                (e.department || 'Sem departamento') === d && isActive(e, p)
            ).length;
          });
          return row;
        });
        setData(rows);
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
        setData(rows);
      } else {
        const rows = periods.map((p) => ({
          period: fmt(p, granularity),
          count: employees.filter((e) => isActive(e, p)).length,
        }));
        setGroups([]);
        setData(rows);
      }
    } else {
      const now = new Date();
      if (groupBy === 'department') {
        const counts: Record<string, number> = {};
        employees.forEach((e) => {
          if (!isActive(e, now)) return;
          const key = e.department || 'Sem departamento';
          counts[key] = (counts[key] || 0) + 1;
        });
        const rows = Object.entries(counts).map(([name, count]) => ({
          name,
          count,
        }));
        setData(rows);
        setGroups([]);
      } else if (groupBy === 'unit') {
        const counts: Record<string, number> = {};
        employees.forEach((e) => {
          if (!isActive(e, now)) return;
          const key = e.unit || 'Sem filial';
          counts[key] = (counts[key] || 0) + 1;
        });
        const rows = Object.entries(counts).map(([name, count]) => ({
          name,
          count,
        }));
        setData(rows);
        setGroups([]);
      } else {
        setData([
          {
            name: 'Total',
            count: employees.filter((e) => isActive(e, now)).length,
          },
        ]);
        setGroups([]);
      }
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
              {start && end ? (
                <XAxis dataKey="period" />
              ) : (
                <XAxis dataKey="name" />
              )}
              <YAxis allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              {start && end && groups.length
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

