import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabaseClient';

export default function ViewEmployee() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [employee, setEmployee] = useState<any>(null);
  const [allFields, setAllFields] = useState<string[]>([]);
  const [fields, setFields] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();
      setEmployee(data);
    };
    load();
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

  if (!employee) return <p>Carregando...</p>;

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
    <div>
      <h1>Ficha do Funcionário</h1>
      <details>
        <summary>Campos</summary>
        {allFields.map((f) => (
          <label key={f} style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={fields.includes(f)}
              onChange={(e) =>
                setFields(
                  e.target.checked
                    ? [...fields, f]
                    : fields.filter((x) => x !== f)
                )
              }
            />{' '}
            {f}
          </label>
        ))}
      </details>
      <button onClick={printDetail}>Imprimir</button>
      <table border="1" cellPadding="4">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
