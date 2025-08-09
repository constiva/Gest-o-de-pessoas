import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import EmployeeStats from '../../components/EmployeeStats';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/button';
import EmployeeViewModal from '../../components/EmployeeViewModal';
import EmployeeConfigModal from '../../components/EmployeeConfigModal';

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
  const [openActions, setOpenActions] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const router = useRouter();

  const refreshCounts = (data: Employee[]) => {
    const active = data.filter((e) => e.status === 'active').length;
    const inactive = data.filter((e) => e.status === 'inactive').length;
    const dismissed = data.filter((e) => e.status === 'dismissed').length;
    setCounts({ active, inactive, dismissed });
  };

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

  useEffect(() => {
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
    const updates: any = { status };
    if (status === 'dismissed') {
      const reason = prompt('Motivo do desligamento?') || '';
      const date =
        prompt('Data do desligamento (YYYY-MM-DD)?') ||
        new Date().toISOString().slice(0, 10);
      updates.termination_date = date;
      updates.termination_reason = reason;
    }
    await supabase.from('employees').update(updates).eq('id', id);
    const newEmployees = employees.map((emp) =>
      emp.id === id ? { ...emp, ...updates } : emp
    );
    setEmployees(newEmployees);
    refreshCounts(newEmployees);
    setOpenActions(null);
  };

  const filtered = employees.filter((emp) =>
    filters.every((f) =>
      f.custom ? emp.custom_fields?.[f.field] === f.value : emp[f.field] === f.value
    )
  );

  const printList = () => {
    const html = `<!DOCTYPE html><html><head><title>Funcionários</title></head><body>` +
      `<table border="1" cellPadding="4"><thead><tr>` +
      columns.map((c) => `<th>${c}</th>`).join('') +
      `</tr></thead><tbody>` +
      filtered
        .map(
          (emp) =>
            `<tr>` +
            columns.map((c) => `<td>${emp[c] ?? ''}</td>`).join('') +
            `</tr>`
        )
        .join('') +
      `</tbody></table></body></html>`;
    const w = window.open('', '', 'height=600,width=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-4">Funcionários</h1>
      <EmployeeStats
        active={counts.active}
        inactive={counts.inactive}
        dismissed={counts.dismissed}
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          className="border p-1"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
        >
          <option value="standard">Campo padrão</option>
          <option value="custom">Campo personalizado</option>
        </select>
        {filterType === 'standard' ? (
          <>
            <select
              className="border p-1"
              value={field}
              onChange={(e) => setField(e.target.value)}
            >
              {allColumns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="border p-1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
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
              className="border p-1"
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
              className="border p-1"
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
        <Button
          onClick={addFilter}
          disabled={filterType === 'standard' ? !value : !customFieldValue}
        >
          Adicionar filtro
        </Button>
      </div>
      <div className="mt-2 space-x-2">
          {filters.map((f, i) => (
            <span key={i} className="bg-purple-50 p-1 rounded">
              {`${f.field}:${f.value}`}
              <button className="ml-1" onClick={() => removeFilter(i)}>
                x
              </button>
            </span>
          ))}
      </div>
      <div className="flex justify-between items-center mt-4 relative">
        <h2 className="text-xl font-semibold">Lista dos funcionários</h2>
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowColumns(!showColumns)}
          >
            Colunas
          </Button>
          {showColumns && (
            <div className="absolute right-0 mt-2 bg-white border p-2 z-20 max-h-60 overflow-y-auto">
              {allColumns.map((c) => (
                <label key={c} className="block">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={columns.includes(c)}
                    onChange={(e) =>
                      setColumns(
                        e.target.checked
                          ? [...columns, c]
                          : columns.filter((col) => col !== c)
                      )
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="my-4 space-x-4 flex items-center">
        <Link href="/employees/new" className="text-brand hover:underline">
          + Adicionar Funcionário
        </Link>
        <button
          onClick={() => setConfigOpen(true)}
          className="text-brand hover:underline"
        >
          Configurações
        </button>
        <Button variant="outline" onClick={printList}>
          Imprimir
        </Button>
      </div>
      <table className="w-full border border-purple-100 text-sm">
        <thead className="bg-purple-50">
          <tr>
            {columns.map((c) => (
              <th key={c} className="border p-2">
                {c}
              </th>
            ))}
            <th className="border p-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((emp) => (
            <tr key={emp.id} className="odd:bg-white even:bg-purple-50/40">
              {columns.map((c) => (
                <td key={c} className="border p-2">
                  {emp[c]}
                </td>
              ))}
              <td className="border p-2 relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setOpenActions(openActions === emp.id ? null : emp.id)
                  }
                >
                  ...
                </Button>
                {openActions === emp.id && (
                  <div className="absolute right-0 bg-white border p-2 z-10 space-y-1">
                    <div>
                      <button
                        className="text-left text-sm text-brand hover:underline"
                        onClick={() => {
                          setOpenActions(null);
                          setViewId(emp.id);
                        }}
                      >
                        Visualizar
                      </button>
                    </div>
                    <div>
                      <button
                        className="text-left text-sm text-brand hover:underline"
                        onClick={() => {
                          setOpenActions(null);
                          router.push(`/employees/${emp.id}`);
                        }}
                      >
                        Editar
                      </button>
                    </div>
                    {emp.status === 'active' ? (
                      <>
                        <div>
                          <button
                            className="text-left text-sm text-brand hover:underline"
                            onClick={() => updateStatus(emp.id, 'inactive')}
                          >
                            Inativar
                          </button>
                        </div>
                        <div>
                          <button
                            className="text-left text-sm text-brand hover:underline"
                            onClick={() => updateStatus(emp.id, 'dismissed')}
                          >
                            Desligar
                          </button>
                        </div>
                      </>
                    ) : emp.status === 'inactive' ? (
                      <>
                        <div>
                          <button
                            className="text-left text-sm text-brand hover:underline"
                            onClick={() => updateStatus(emp.id, 'active')}
                          >
                            Ativar
                          </button>
                        </div>
                        <div>
                          <button
                            className="text-left text-sm text-brand hover:underline"
                            onClick={() => updateStatus(emp.id, 'dismissed')}
                          >
                            Desligar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div>
                        <button
                          className="text-left text-sm text-brand hover:underline"
                          onClick={() => updateStatus(emp.id, 'active')}
                        >
                          Ativar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <EmployeeConfigModal
        open={configOpen}
        onClose={() => {
          setConfigOpen(false);
          load();
        }}
      />
      {viewId && (
        <EmployeeViewModal id={viewId} onClose={() => setViewId(null)} />
      )}
    </Layout>
  );
}
