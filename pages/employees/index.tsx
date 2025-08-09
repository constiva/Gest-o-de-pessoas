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
import {
  Users,
  UserPlus,
  Settings,
  Filter,
  Columns,
  Printer,
  Eye,
  Pencil,
  UserMinus,
  UserX,
  UserCheck,
} from 'lucide-react';

const defaultViewCols = ['name','email','phone','cpf','position','department'];

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
  const [views, setViews] = useState<any[]>([]);
  const [currentView, setCurrentView] = useState<any | null>(null);
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
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
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
  const activeEmp = openActions
    ? employees.find((e) => e.id === openActions) || null
    : null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.column-menu')) setShowColumns(false);
      if (!target.closest('.print-menu')) setShowPrint(false);
      if (!target.closest('.actions-menu')) {
        setOpenActions(null);
        setMenuPos(null);
      }
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
    const { data: viewRows } = await supabase
      .from('employee_views')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });
    let view = viewRows && viewRows.length ? viewRows[0] : null;
    if (!view) {
      const { data: created } = await supabase
        .from('employee_views')
        .insert({
          user_id: session.user.id,
          name: 'Principal',
          columns: defaultViewCols,
          filters: [],
        })
        .select()
        .single();
      view = created;
      setViews([created]);
    } else {
      setViews(viewRows);
    }
    setCurrentView(view);
    setColumns(view?.columns && view.columns.length ? view.columns : defaultViewCols);
    setFilters(view?.filters || []);
    setField(all[0] || '');
  };

  useEffect(() => {
    load();
  }, []);

  const switchView = (v: any) => {
    setCurrentView(v);
    setColumns(v.columns || []);
    setFilters(v.filters || []);
    setField(allColumns[0] || '');
  };

  const addView = async () => {
    const name = prompt('Nome da nova lista');
    if (!name) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const { data: created } = await supabase
      .from('employee_views')
      .insert({
        user_id: session.user.id,
        name,
        columns: defaultViewCols,
        filters: [],
      })
      .select()
      .single();
    setViews([...views, created]);
    switchView(created);
  };

  const deleteView = async (id: string) => {
    const target = views.find((v) => v.id === id);
    if (!target || target.name === 'Principal') return;
    if (!confirm('Excluir esta lista?')) return;
    await supabase.from('employee_views').delete().eq('id', id);
    setViews((vs) => vs.filter((v) => v.id !== id));
    if (currentView?.id === id) {
      const next = views.find((v) => v.id !== id) || null;
      if (next) switchView(next);
    }
  };

  useEffect(() => {
    if (!currentView) return;
    supabase.from('employee_views').update({ columns }).eq('id', currentView.id);
    setCurrentView((cv) => (cv ? { ...cv, columns } : cv));
    setViews((vs) => vs.map((v) => (v.id === currentView.id ? { ...v, columns } : v)));
  }, [columns, currentView?.id]);
  // filters are saved explicitly when added or removed

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

  const addFilter = async () => {
    let newFilters = [...filters];
    if (filterType === 'standard') {
      if (isTextField(field) && textValue) {
        newFilters = [...newFilters, { field, value: textValue, type: 'text' }];
        setTextValue('');
      } else if (isRangeField(field) && (rangeStart || rangeEnd)) {
        newFilters = [
          ...newFilters,
          { field, min: rangeStart, max: rangeEnd, type: 'range' },
        ];
        setRangeStart('');
        setRangeEnd('');
      } else if (value) {
        newFilters = [...newFilters, { field, value, type: 'equal' }];
        setValue('');
      } else {
        return;
      }
    } else if (customFieldName && customFieldValue) {
      newFilters = [
        ...newFilters,
        { field: customFieldName, value: customFieldValue, custom: true },
      ];
      setCustomFieldName('');
      setCustomFieldValue('');
    } else {
      return;
    }
    setFilters(newFilters);
    setShowFilter(false);
    if (currentView) {
      await supabase
        .from('employee_views')
        .update({ filters: newFilters })
        .eq('id', currentView.id);
      setCurrentView({ ...currentView, filters: newFilters });
      setViews((vs) =>
        vs.map((v) => (v.id === currentView.id ? { ...v, filters: newFilters } : v))
      );
    }
  };

  const removeFilter = async (i: number) => {
    const newFilters = filters.filter((_, idx) => idx !== i);
    setFilters(newFilters);
    if (currentView) {
      await supabase
        .from('employee_views')
        .update({ filters: newFilters })
        .eq('id', currentView.id);
      setCurrentView({ ...currentView, filters: newFilters });
      setViews((vs) =>
        vs.map((v) => (v.id === currentView.id ? { ...v, filters: newFilters } : v))
      );
    }
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
            <Link href="/employees/new" className="flex items-center gap-1">
              <UserPlus className="h-4 w-4" /> Adicionar Funcionário
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfigOpen(true)}
            className="flex items-center gap-1"
          >
            <Settings className="h-4 w-4" /> Configurações
          </Button>
        </div>
      </div>
      <EmployeeStats
        active={counts.active}
        inactive={counts.inactive}
        dismissed={counts.dismissed}
      />
      <div className="flex justify-between items-center mt-4 relative">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-brand" />
          <h2 className="text-2xl font-semibold">Lista dos funcionários</h2>
          <select
            className="border rounded p-1"
            value={currentView?.id || ''}
            onChange={(e) => {
              const v = views.find((view) => view.id === e.target.value);
              if (v) switchView(v);
            }}
          >
            {views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={addView}>
            Nova lista
          </Button>
          {currentView && currentView.name !== 'Principal' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteView(currentView.id)}
            >
              Excluir
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilter(!showFilter)}
            className="flex items-center gap-1"
          >
            <Filter className="h-4 w-4" /> Adicionar filtro
          </Button>
          <div className="relative column-menu">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColumns(!showColumns)}
              className="flex items-center gap-1"
            >
              <Columns className="h-4 w-4" /> Colunas
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
              className="flex items-center gap-1"
            >
              <Printer className="h-4 w-4" /> Imprimir
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
      <div className="mt-4 w-full overflow-x-auto overflow-y-visible">
        <table className="min-w-full border border-purple-100 text-sm border-collapse">
          <thead className="bg-purple-50">
            <tr>
              <th className="border px-2 py-1 text-center">Ações</th>
              {columns.map((c) => (
                <th key={c} className="border px-2 py-1 text-center">
                  {getFieldLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <tr key={emp.id} className="odd:bg-white even:bg-purple-50/40">
                <td className="border px-2 py-1 text-center">
                  <div className="actions-menu inline-block">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        const rect = (
                          e.currentTarget as HTMLElement
                        ).getBoundingClientRect();
                        setMenuPos({ x: rect.right, y: rect.bottom });
                        setOpenActions(openActions === emp.id ? null : emp.id);
                      }}
                    >
                      ...
                    </Button>
                  </div>
                </td>
                {columns.map((c) => (
                  <td key={c} className="border px-2 py-1 text-center">
                    {emp[c]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openActions && activeEmp && menuPos && (
        <div
          className="fixed bg-white border p-2 z-50 space-y-1 actions-menu"
          style={{ top: menuPos.y, left: menuPos.x }}
        >
          <div>
            <button
              className="text-left text-sm text-brand hover:underline flex items-center gap-1"
              onClick={() => {
                setOpenActions(null);
                setViewId(activeEmp.id);
              }}
            >
              <Eye className="h-4 w-4" /> Visualizar
            </button>
          </div>
          <div>
            <button
              className="text-left text-sm text-brand hover:underline flex items-center gap-1"
              onClick={() => {
                setOpenActions(null);
                router.push(`/employees/${activeEmp.id}`);
              }}
            >
              <Pencil className="h-4 w-4" /> Editar
            </button>
          </div>
          {activeEmp.status === 'active' ? (
            <>
              <div>
                <button
                  className="text-left text-sm text-brand hover:underline flex items-center gap-1"
                  onClick={() => updateStatus(activeEmp.id, 'inactive')}
                >
                  <UserMinus className="h-4 w-4" /> Inativar
                </button>
              </div>
              <div>
                <button
                  className="text-left text-sm text-brand hover:underline flex items-center gap-1"
                  onClick={() => {
                    setOpenActions(null);
                    setDismissDate(new Date().toISOString().slice(0, 10));
                    setDismissReason('');
                    setDismissId(activeEmp.id);
                  }}
                >
                  <UserX className="h-4 w-4" /> Desligar
                </button>
              </div>
            </>
          ) : activeEmp.status === 'inactive' ? (
            <>
              <div>
                <button
                  className="text-left text-sm text-brand hover:underline flex items-center gap-1"
                  onClick={() => updateStatus(activeEmp.id, 'active')}
                >
                  <UserCheck className="h-4 w-4" /> Ativar
                </button>
              </div>
              <div>
                <button
                  className="text-left text-sm text-brand hover:underline flex items-center gap-1"
                  onClick={() => {
                    setOpenActions(null);
                    setDismissDate(new Date().toISOString().slice(0, 10));
                    setDismissReason('');
                    setDismissId(activeEmp.id);
                  }}
                >
                  <UserX className="h-4 w-4" /> Desligar
                </button>
              </div>
            </>
          ) : (
            <div>
              <button
                className="text-left text-sm text-brand hover:underline flex items-center gap-1"
                onClick={() => updateStatus(activeEmp.id, 'active')}
              >
                <UserCheck className="h-4 w-4" /> Ativar
              </button>
            </div>
          )}
        </div>
      )}
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
