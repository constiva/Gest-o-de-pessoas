import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import EmployeeForm from '../../components/EmployeeForm';
import { supabase } from '../../lib/supabaseClient';
import Layout from '../../components/Layout';

export default function EditEmployee() {
  const router = useRouter();
  const { id } = router.query as { id?: string };
  const [employee, setEmployee] = useState<any>(null);

  useEffect(() => {
    if (!id || id === 'new') return;
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

  if (id === 'new') {
    return (
      <Layout>
        <EmployeeForm />
      </Layout>
    );
  }

  if (!employee) return <p>Carregando...</p>;

  return (
    <Layout>
      <EmployeeForm employee={employee} />
    </Layout>
  );
}
