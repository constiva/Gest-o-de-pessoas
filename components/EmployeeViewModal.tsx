import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';

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

  if (!employee) return null;

  const entries = [
    ...Object.entries(employee).filter(([k]) => k !== 'custom_fields'),
    ...(employee.custom_fields ? Object.entries(employee.custom_fields) : []),
  ].filter(([k]) => fields.includes(k));

  const printDetail = () => {
    const html = `<!DOCTYPE html><html><head><title>Ficha</title></head><body>` +
      `<table border="1" cellPadding="4"><tbody>` +
      entries
        .map(
          ([k, v]) => `<tr><td>${k}</td><td>${String(v)}</td></tr>`
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Ficha do Funcionário</h2>
          <button onClick={onClose}>X</button>
        </div>
        <div className="relative mb-4">
          <Button variant="outline" size="sm" onClick={() => setShowFields(!showFields)}>
            Campos
          </Button>
          {showFields && (
            <div className="absolute right-0 mt-2 bg-white border p-2 z-20 max-h-60 overflow-y-auto">
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
                  {f}
                </label>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" className="mb-4" onClick={printDetail}>
          Imprimir
        </Button>
        <table className="w-full border border-purple-100 text-sm">
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className="odd:bg-white even:bg-purple-50/40">
                <td className="border p-2 font-medium">{k}</td>
                <td className="border p-2">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
