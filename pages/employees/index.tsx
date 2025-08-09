import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import EmployeeStats from '../../components/EmployeeStats';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/button';
import EmployeeViewModal from '../../components/EmployeeViewModal';
import EmployeeConfigModal from '../../components/EmployeeConfigModal';
import { getFieldLabel } from '../../lib/utils';

interface Employee {
  id: string;
  custom_fields?: Record<string, string>;
  [key: string]: any;
}

interface Filter {
  field: string;
  value?: string;
  custom?: boolean;
  min?: string;
  max?: string;
  type?: 'text' | 'range' | 'equal';
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [filtersReady, setFiltersReady] = useState(false);
  const [counts, setCounts] = useState({ active: 0, inactive: 0, dismissed: 0 });
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [valueOptions, setValueOptions] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<'standard' | 'custom'>('standard');
  const [customFieldName, setCustomFieldName] = useState('');
  const [customFieldValue, setCustomFieldValue] = useState('');
  const [customFieldDefs, setCustomFieldDefs] = useState<Record<string, string[]>>({});
  const [openActions, setOpenActions] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [dismissId, setDismissId] = useState<string | null>(null);
  const [dismissDate, setDismissDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dismissReason, setDismissReason] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.column-menu')) setShowColumns(false);
      if (!target.closest('.print-menu')) setShowPrint(false);
      if (!target.closest('.actions-menu')) setOpenActions(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    const { data: savedFilters } = await supabase
      .from('employee_filters')
      .select('filters')
      .eq('user_id', session.user.id)
      .single();
    setFilters(savedFilters?.filters || []);
    setFiltersReady(true);
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
    if (!filtersReady) return;
    const save = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      await supabase
        .from('employee_filters')
        .upsert({ user_id: session.user.id, filters });
    };
    save();
  }, [filters, filtersReady]);

  const isTextField = (f: string) => ['name', 'email'].includes(f);
  const isRangeField = (f: string) => f === 'salary' || f.endsWith('_date');

  useEffect(() => {
    if (filterType === 'standard' && !isTextField(field) && !isRangeField(field)) {
      const opts = Array.from(
        new Set(
          employees
            .map((e) => e[field])
            .filter((v) => v !== undefined && v !== null)
        )
      );
      setValueOptions(opts);
      if (!opts.includes(value)) setValue('');
    } else {
      setValueOptions([]);
      setValue('');
    }
    setTextValue('');
    setRangeStart('');
    setRangeEnd('');
  }, [field, employees, filterType]);

  const addFilter = () => {
    if (filterType === 'standard') {
      if (isTextField(field) && textValue) {
        setFilters([...filters, { field, value: textValue, type: 'text' }]);
        setTextValue('');
      } else if (isRangeField(field) && (rangeStart || rangeEnd)) {
        setFilters([
          ...filters,
          { field, min: rangeStart, max: rangeEnd, type: 'range' },
        ]);
        setRangeStart('');
        setRangeEnd('');
      } else if (value) {
        setFilters([...filters, { field, value, type: 'equal' }]);
        setValue('');
      }
    } else if (customFieldName && customFieldValue) {
      setFilters([
        ...filters,
        { field: customFieldName, value: customFieldValue, custom: true },
      ]);
      setCustomFieldName('');
      setCustomFieldValue('');
    }
    setShowFilter(false);
  };

  const removeFilter = (i: number) => {
    setFilters(filters.filter((_, idx) => idx !== i));
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    await supabase.from('employees').update(updates).eq('id', id);
    const newEmployees = employees.map((emp) =>
      emp.id === id ? { ...emp, ...updates } : emp
    );
    setEmployees(newEmployees);
    refreshCounts(newEmployees);
    setOpenActions(null);
  };

  const confirmDismiss = async () => {
    if (!dismissId) return;
    const updates: any = {
      status: 'dismissed',
      termination_date: dismissDate,
      termination_reason: dismissReason,
    };
    await supabase.from('employees').update(updates).eq('id', dismissId);
    const newEmployees = employees.map((emp) =>
      emp.id === dismissId ? { ...emp, ...updates } : emp
    );
    setEmployees(newEmployees);
    refreshCounts(newEmployees);
    setDismissId(null);
    setDismissReason('');
  };

  const filtered = employees.filter((emp) =>
    filters.every((f) => {
      const fieldValue = f.custom
        ? emp.custom_fields?.[f.field]
        : emp[f.field];
      if (f.type === 'text') {
        return String(fieldValue || '')
          .toLowerCase()
          .includes((f.value || '').toLowerCase());
      } else if (f.type === 'range') {
        if (!fieldValue) return false;
        const val = f.field.includes('date')
          ? String(fieldValue)
          : parseFloat(fieldValue);
        if (f.min) {
          const min = f.field.includes('date') ? f.min : parseFloat(f.min);
          if (val < min) return false;
        }
        if (f.max) {
          const max = f.field.includes('date') ? f.max : parseFloat(f.max);
          if (val > max) return false;
        }
        return true;
      } else {
        return fieldValue === f.value;
      }
    })
  );

  const generateProfileHTML = (emp: any, fields: string[]) => {
    const groups = [
      {
        title: 'Informações pessoais',
        fields: ['name', 'email', 'phone', 'cpf', 'gender'],
      },
      { title: 'Endereço', fields: ['street', 'city', 'state', 'zip'] },
      {
        title: 'Informações profissionais',
        fields: ['position', 'department', 'salary', 'hire_date', 'status'],
      },
      {
        title: 'Contato de emergência',
        fields: [
          'emergency_contact_name',
          'emergency_contact_phone',
          'emergency_contact_relation',
        ],
      },
      {
        title: 'Outros',
        fields: ['resume_url', 'comments'],
      },
    ];
    const customEntries = emp.custom_fields ? Object.entries(emp.custom_fields) : [];
    const customFields = customEntries.filter(([k]) => fields.includes(k));
    let html = `<div class="card"><h2>${emp.name || ''}</h2>`;
    groups.forEach((g) => {
      const rows = g.fields
        .filter((f) => fields.includes(f) && emp[f])
        .map(
          (f) =>
            `<tr><td class="label">${getFieldLabel(f)}</td><td>${emp[f]}</td></tr>`
        )
        .join('');
      if (rows) {
        html += `<h3>${g.title}</h3><table>${rows}</table>`;
      }
    });
    if (customFields.length) {
      const rows = customFields
        .map(
          ([k, v]) =>
            `<tr><td class="label">${getFieldLabel(k)}</td><td>${v}</td></tr>`
        )
        .join('');
      html += `<h3>Campos personalizados</h3><table>${rows}</table>`;
    }
    html += '</div>';
    return html;
  };

  const printList = () => {
    const html =
      `<!DOCTYPE html><html><head><title>Funcionários</title><style>` +
      `table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:4px}` +
      `th{background:#f3e8ff}h2{margin-top:0}` +
      `.card{border:1px solid #ddd;padding:10px;margin-bottom:10px}` +
      `.label{font-weight:bold;background:#f9f9f9}` +
      `</style></head><body>` +
      `<table><thead><tr>` +
      columns.map((c) => `<th>${getFieldLabel(c)}</th>`).join('') +
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

  const printProfiles = () => {
    const html =
      `<!DOCTYPE html><html><head><title>Fichas</title><style>` +
      `table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:4px}` +
      `h2{margin:0 0 10px 0}h3{margin:10px 0 4px 0}` +
      `.card{border:1px solid #ddd;padding:10px;margin-bottom:20px}` +
      `.label{font-weight:bold;background:#f9f9f9}` +
      `</style></head><body>` +
      filtered
        .map((emp) => generateProfileHTML(emp, columns))
        .join('') +
      `</body></html>`;
    const w = window.open('', '', 'height=600,width=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Funcionários</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/employees/new">Adicionar Funcionário</Link>
          </Button>
          <Button variant="outline" onClick={() => setConfigOpen(true)}>
            Configurações
          </Button>
        </div>
      </div>
      <EmployeeStats
        active={counts.active}
        inactive={counts.inactive}
        dismissed={counts.dismissed}
      />
      <div className="flex justify-between items-center mt-4 relative">
        <h2 className="text-xl font-semibold">Lista dos funcionários</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilter(!showFilter)}
          >
            Adicionar filtro
          </Button>
          <div className="relative column-menu">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColumns(!showColumns)}
            >
              Colunas
            </Button>
            {showColumns && (
              <div className="absolute right-0 mt-2 bg-white border p-2 z-20 max-h-60 overflow-y-auto w-72">
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
                    {getFieldLabel(c)}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="relative print-menu">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPrint(!showPrint)}
            >
              Imprimir
            </Button>
            {showPrint && (
              <div className="absolute right-0 mt-2 bg-white border p-2 z-20">
                <button
                  className="block text-left w-full hover:underline text-sm"
                  onClick={() => {
                    setShowPrint(false);
                    printList();
                  }}
                >
                  Lista
                </button>
                <button
                  className="block text-left w-full hover:underline text-sm"
                  onClick={() => {
                    setShowPrint(false);
                    printProfiles();
                  }}
                >
                  Fichas
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showFilter && (
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
                    {getFieldLabel(c)}
                  </option>
                ))}
              </select>
              {isTextField(field) ? (
                <input
                  className="border p-1"
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="texto"
                />
              ) : isRangeField(field) ? (
                <>
                  <input
                    className="border p-1 w-24"
                    type={field === 'salary' ? 'number' : 'date'}
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    placeholder="mín"
                  />
                  <input
                    className="border p-1 w-24"
                    type={field === 'salary' ? 'number' : 'date'}
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    placeholder="máx"
                  />
                </>
              ) : (
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
              )}
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
            disabled={
              filterType === 'standard'
                ? isTextField(field)
                  ? !textValue
                  : isRangeField(field)
                  ? !rangeStart && !rangeEnd
                  : !value
                : !customFieldValue
            }
          >
            Aplicar
          </Button>
        </div>
      )}
      {filters.length > 0 && (
        <div className="mt-2 space-x-2">
          <span className="font-semibold">Filtros ativos:</span>
          {filters.map((f, i) => (
            <span key={i} className="bg-purple-50 p-1 rounded">
              {`${getFieldLabel(f.field)}:`}
              {f.type === 'range'
                ? `${f.min || ''}-${f.max || ''}`
                : f.value}
              <button className="ml-1" onClick={() => removeFilter(i)}>
                x
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 w-full overflow-x-auto">
        <table className="min-w-full border border-purple-100 text-sm border-collapse">
          <thead className="bg-purple-50">
            <tr>
              <th className="border px-2 py-1">Ações</th>
              {columns.map((c) => (
                <th key={c} className="border px-2 py-1">
                  {getFieldLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <tr key={emp.id} className="odd:bg-white even:bg-purple-50/40">
                <td className="border px-2 py-1">
                  <div className="relative actions-menu">
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
                                onClick={() => {
                                  setOpenActions(null);
                                  setDismissDate(
                                    new Date().toISOString().slice(0, 10)
                                  );
                                  setDismissReason('');
                                  setDismissId(emp.id);
                                }}
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
                                onClick={() => {
                                  setOpenActions(null);
                                  setDismissDate(
                                    new Date().toISOString().slice(0, 10)
                                  );
                                  setDismissReason('');
                                  setDismissId(emp.id);
                                }}
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
                  </div>
                </td>
                {columns.map((c) => (
                  <td key={c} className="border px-2 py-1">
                    {emp[c]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
      {dismissId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-4 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Desligar Funcionário</h2>
            <label className="block mb-2">
              Data
              <input
                type="date"
                className="border p-1 w-full"
                value={dismissDate}
                onChange={(e) => setDismissDate(e.target.value)}
              />
            </label>
            <label className="block mb-4">
              Motivo
              <textarea
                className="border p-1 w-full"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDismissId(null)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  await confirmDismiss();
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
