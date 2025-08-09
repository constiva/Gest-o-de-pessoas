import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabaseClient';

export default function ViewEmployee() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [employee, setEmployee] = useState<any>(null);

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

  if (!employee) return <p>Carregando...</p>;

  const baseEntries = Object.entries(employee).filter(([k]) => k !== 'custom_fields');

  return (
    <div>
      <h1>Ficha do Funcionário</h1>
      <table border="1" cellPadding="4">
        <tbody>
          {baseEntries.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{String(v)}</td>
            </tr>
          ))}
          {employee.custom_fields &&
            Object.entries(employee.custom_fields).map(([k, v]) => (
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
