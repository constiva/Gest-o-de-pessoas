import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import EmployeeForm from '../../components/EmployeeForm';
import { supabase } from '../../lib/supabaseClient';

export default function EditEmployee() {
  const router = useRouter();
  const { id } = router.query;
  const [employee, setEmployee] = useState(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase.from('employees').select('*').eq('id', id).single();
      setEmployee(data);
    };
    load();
  }, [id]);

  if (!employee) return <p>Carregando...</p>;
  return <EmployeeForm employee={employee} />;
}
