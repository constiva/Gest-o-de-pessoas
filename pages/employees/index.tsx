import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import EmployeeStats from '../../components/EmployeeStats';

interface Employee {
  id: string;
  [key: string]: any;
}

interface Filter {
  field: string;
  value: string;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [counts, setCounts] = useState({ active: 0, inactive: 0, dismissed: 0 });
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const [valueOptions, setValueOptions] = useState<string[]>([]);
  const router = useRouter();

  const refreshCounts = (data: Employee[]) => {
    const active = data.filter((e) => e.status === 'active').length;
    const inactive = data.filter((e) => e.status === 'inactive').length;
    const dismissed = data.filter((e) => e.status === 'dismissed').length;
    setCounts({ active, inactive, dismissed });
  };

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: user } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', session.user.id)
        .single();
      const { data = [] } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', user.company_id);
      setEmployees(data);
      refreshCounts(data);
      const cols = data.length
        ? Object.keys(data[0]).filter((k) => k !== 'company_id')
        : [];
      setAllColumns(cols);
      const saved = localStorage.getItem('employeeColumns');
      setColumns(saved ? JSON.parse(saved) : cols);
      setField(cols[0] || '');
    };
    load();
  }, []);

  useEffect(() => {
    if (columns.length) {
      localStorage.setItem('employeeColumns', JSON.stringify(columns));
    }
  }, [columns]);

  useEffect(() => {
    const opts = Array.from(
      new Set(employees.map((e) => e[field]).filter((v) => v !== undefined && v !== null))
    );
    setValueOptions(opts);
    if (!opts.includes(value)) setValue('');
  }, [field, employees]);

  const addFilter = () => {
    if (value) {
      setFilters([...filters, { field, value }]);
      setValue('');
    }
  };

  const removeFilter = (i: number) => {
    setFilters(filters.filter((_, idx) => idx !== i));
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('employees').update({ status }).eq('id', id);
    const newEmployees = employees.map((emp) =>
      emp.id === id ? { ...emp, status } : emp
    );
    setEmployees(newEmployees);
    refreshCounts(newEmployees);
  };

  const filtered = employees.filter((emp) =>
    filters.every((f) => emp[f.field] === f.value)
  );

  return (
    <div>
      <h1>Funcionários</h1>
      <EmployeeStats
        active={counts.active}
        inactive={counts.inactive}
        dismissed={counts.dismissed}
      />
      <div>
        <select value={field} onChange={(e) => setField(e.target.value)}>
          {allColumns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">valor</option>
          {valueOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button onClick={addFilter} disabled={!value}>
          Adicionar filtro
        </button>
      </div>
      <div>
        {filters.map((f, i) => (
          <span key={i} style={{ marginRight: 8 }}>
            {f.field}:{f.value}
            <button onClick={() => removeFilter(i)}>x</button>
          </span>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2>Lista dos funcionários</h2>
        <details>
          <summary>Colunas</summary>
          {allColumns.map((c) => (
            <label key={c} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={columns.includes(c)}
                onChange={(e) =>
                  setColumns(
                    e.target.checked ? [...columns, c] : columns.filter((col) => col !== c)
                  )
                }
              />{' '}
              {c}
            </label>
          ))}
        </details>
      </div>
      <Link href="/employees/new">+ Adicionar Funcionário</Link>
      <table border="1" cellPadding="4">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((emp) => (
            <tr key={emp.id}>
              {columns.map((c) => (
                <td key={c}>{emp[c]}</td>
              ))}
              <td>
                <button onClick={() => router.push(`/employees/${emp.id}`)}>Editar</button>{' '}
                <button onClick={() => updateStatus(emp.id, 'inactive')}>Inativar</button>{' '}
                <button onClick={() => updateStatus(emp.id, 'dismissed')}>Desligar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
