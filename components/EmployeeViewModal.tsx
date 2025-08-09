import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';
import { getFieldLabel } from '../lib/utils';
import { Columns, Printer, X } from 'lucide-react';

interface Props {
  id: string;
  onClose: () => void;
}

export default function EmployeeViewModal({ id, onClose }: Props) {
  const [employee, setEmployee] = useState<any>(null);
  const [allFields, setAllFields] = useState<string[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [showFields, setShowFields] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();
      setEmployee(data);
    };
    if (id) load();
  }, [id]);

  useEffect(() => {
    if (!employee) return;
    const base = Object.keys(employee).filter((k) => k !== 'custom_fields');
    const custom = employee.custom_fields ? Object.keys(employee.custom_fields) : [];
    const all = [...base, ...custom];
    setAllFields(all);
    const saved = localStorage.getItem('employeeViewFields');
    setFields(saved ? JSON.parse(saved) : all);
  }, [employee]);

  useEffect(() => {
    if (fields.length) {
      localStorage.setItem('employeeViewFields', JSON.stringify(fields));
    }
  }, [fields]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.view-fields-menu')) setShowFields(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!employee) return null;

  const baseEntries = Object.entries(employee).filter(
    ([k]) => k !== 'custom_fields'
  );
  const customEntries = employee.custom_fields
    ? Object.entries(employee.custom_fields)
    : [];
  const entries = [...baseEntries, ...customEntries].filter(([k]) =>
    fields.includes(k)
  );

  const groups = [
    {
      title: 'Informações pessoais',
      fields: ['name', 'email', 'phone', 'cpf', 'gender'],
    },
    {
      title: 'Endereço',
      fields: ['street', 'city', 'state', 'zip'],
    },
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

  const customFieldEntries = customEntries.filter(([k]) => fields.includes(k));

  const generateProfileHTML = () => {
    let html = `<div class=\"card\"><h2>${employee.name || ''}</h2>`;
    groups.forEach((g) => {
      const rows = g.fields
        .filter((f) => fields.includes(f) && employee[f])
        .map(
          (f) =>
            `<tr><td class=\"label\">${getFieldLabel(f)}</td><td>${employee[f]}</td></tr>`
        )
        .join('');
      if (rows) {
        html += `<h3>${g.title}</h3><table>${rows}</table>`;
      }
    });
    if (customFieldEntries.length) {
      const rows = customFieldEntries
        .map(
          ([k, v]) =>
            `<tr><td class=\"label\">${getFieldLabel(k)}</td><td>${v}</td></tr>`
        )
        .join('');
      if (rows) {
        html += `<h3>Campos personalizados</h3><table>${rows}</table>`;
      }
    }
    html += '</div>';
    return html;
  };

  const printDetail = () => {
    const html =
      `<!DOCTYPE html><html><head><title>Ficha</title><style>` +
      `table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:4px}` +
      `.card{border:1px solid #ddd;padding:10px;margin-bottom:10px}` +
      `.label{font-weight:bold;background:#f9f9f9}` +
      `</style></head><body>` +
      generateProfileHTML() +
      `</body></html>`;
    const w = window.open('', '', 'height=600,width=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Ficha do Funcionário</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative mb-4 view-fields-menu">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFields(!showFields)}
            className="flex items-center gap-1"
          >
            <Columns className="h-4 w-4" /> Campos
          </Button>
          {showFields && (
            <div className="absolute right-0 mt-2 bg-white border p-2 z-20 max-h-60 overflow-y-auto w-60">
              {allFields.map((f) => (
                <label key={f} className="block">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={fields.includes(f)}
                    onChange={(e) =>
                      setFields(
                        e.target.checked
                          ? [...fields, f]
                          : fields.filter((x) => x !== f)
                      )
                    }
                  />
                  {getFieldLabel(f)}
                </label>
              ))}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mb-4 flex items-center gap-1"
          onClick={printDetail}
        >
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
        {groups.map((group) => {
          const groupRows = group.fields
            .filter((f) =>
              typeof (employee as any)[f] !== 'undefined' && fields.includes(f)
            )
            .map((f) => [f, (employee as any)[f]] as [string, any]);
          if (!groupRows.length) return null;
          return (
            <div key={group.title} className="mb-4">
              <h3 className="font-semibold mb-2">{group.title}</h3>
              <table className="w-full border border-purple-100 text-sm">
                <tbody>
                  {groupRows.map(([k, v]) => (
                    <tr key={k} className="odd:bg-white even:bg-purple-50/40">
                      <td className="border p-2 font-medium">{getFieldLabel(k)}</td>
                      <td className="border p-2">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        {customFieldEntries.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Campos personalizados</h3>
            <table className="w-full border border-purple-100 text-sm">
              <tbody>
                {customFieldEntries.map(([k, v]) => (
                  <tr key={k} className="odd:bg-white even:bg-purple-50/40">
                    <td className="border p-2 font-medium">{getFieldLabel(k)}</td>
                    <td className="border p-2">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
