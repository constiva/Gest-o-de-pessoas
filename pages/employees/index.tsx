import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import EmployeeStats from '../../components/EmployeeStats';

interface Employee {
  id: string;
  custom_fields?: Record<string, string>;
  [key: string]: any;
}

interface Filter {
  field: string;
  value: string;
  custom?: boolean;
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
  const [filterType, setFilterType] = useState<'standard' | 'custom'>('standard');
  const [customFieldName, setCustomFieldName] = useState('');
  const [customFieldValue, setCustomFieldValue] = useState('');
  const [customFieldDefs, setCustomFieldDefs] = useState<Record<string, string[]>>({});
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
      const { data: defs } = await supabase
        .from('custom_fields')
        .select('field,value')
        .eq('company_id', user.company_id);
      const defMap: Record<string, string[]> = {};
      defs?.forEach((d: any) => {
        defMap[d.field] = defMap[d.field] ? [...defMap[d.field], d.value] : [d.value];
      });
      setCustomFieldDefs(defMap);
      const { data = [] } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', user.company_id);
      const expanded = data.map((emp) => ({ ...emp, ...emp.custom_fields }));
      setEmployees(expanded);
      refreshCounts(expanded);
      const cols = expanded.length
        ? Object.keys(expanded[0]).filter((k) => k !== 'company_id' && k !== 'custom_fields')
        : [];
      const all = Array.from(new Set([...cols, ...Object.keys(defMap)]));
      setAllColumns(all);
      const saved = localStorage.getItem('employeeColumns');
      setColumns(saved ? JSON.parse(saved) : all);
      setField(all[0] || '');
    };
    load();
  }, []);

  useEffect(() => {
    if (columns.length) {
      localStorage.setItem('employeeColumns', JSON.stringify(columns));
    }
  }, [columns]);

  useEffect(() => {
    if (filterType === 'standard') {
      const opts = Array.from(
        new Set(employees.map((e) => e[field]).filter((v) => v !== undefined && v !== null))
      );
      setValueOptions(opts);
      if (!opts.includes(value)) setValue('');
    }
  }, [field, employees, filterType]);

  const addFilter = () => {
    if (filterType === 'standard' && value) {
      setFilters([...filters, { field, value }]);
      setValue('');
    } else if (filterType === 'custom' && customFieldName && customFieldValue) {
      setFilters([...filters, { field: customFieldName, value: customFieldValue, custom: true }]);
      setCustomFieldName('');
      setCustomFieldValue('');
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
    filters.every((f) =>
      f.custom ? emp.custom_fields?.[f.field] === f.value : emp[f.field] === f.value
    )
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
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
          <option value="standard">Campo padrão</option>
          <option value="custom">Campo personalizado</option>
        </select>
        {filterType === 'standard' ? (
          <>
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
          </>
        ) : (
          <>
            <select
              value={customFieldName}
              onChange={(e) => {
                setCustomFieldName(e.target.value);
                setCustomFieldValue('');
              }}
            >
              <option value="">campo</option>
              {Object.keys(customFieldDefs).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={customFieldValue}
              onChange={(e) => setCustomFieldValue(e.target.value)}
            >
              <option value="">valor</option>
              {(customFieldDefs[customFieldName] || []).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </>
        )}
        <button onClick={addFilter} disabled={filterType === 'standard' ? !value : !customFieldValue}>
          Adicionar filtro
        </button>
      </div>
      <div>
        {filters.map((f, i) => (
          <span key={i} style={{ marginRight: 8 }}>
            {`${f.field}:${f.value}`}
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
      <div>
        <Link href="/employees/new">+ Adicionar Funcionário</Link>{' '}
        <Link href="/employees/config">Configurações</Link>
      </div>
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
