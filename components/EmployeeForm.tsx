import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

interface Employee {
  id?: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  position: string;
  department: string;
  salary: string;
  hire_date: string;
  status: string;
  gender: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  resume_url: string;
  comments: string;
  custom_fields: Record<string, string>;
  company_id?: string;
}

const defaultEmployee: Employee = {
  name: '',
  email: '',
  phone: '',
  cpf: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  position: '',
  department: '',
  salary: '',
  hire_date: '',
  status: 'active',
  gender: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relation: '',
  resume_url: '',
  comments: '',
  custom_fields: {},
};

export default function EmployeeForm({ employee }: { employee?: Employee }) {
  const [form, setForm] = useState<Employee>(employee ? { ...employee, custom_fields: employee.custom_fields || {} } : defaultEmployee);
  const router = useRouter();
  const isEdit = !!employee;
  const [company, setCompany] = useState<any>(null);
  const [customFieldDefs, setCustomFieldDefs] = useState<Record<string, string[]>>({});
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    setForm(employee ? { ...employee, custom_fields: employee.custom_fields || {} } : defaultEmployee);
  }, [employee]);

  useEffect(() => {
    const loadCompany = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const { data: user } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', session.user.id)
        .single();
      const { data: comp } = await supabase
        .from('companies')
        .select('*')
        .eq('id', user.company_id)
        .single();
      setCompany(comp);
      const { data: defs } = await supabase
        .from('custom_fields')
        .select('field,value')
        .eq('company_id', user.company_id);
      const map: Record<string, string[]> = {};
      defs?.forEach((d: any) => {
        map[d.field] = map[d.field] ? [...map[d.field], d.value] : [d.value];
      });
      setCustomFieldDefs(map);
      const { data: deps } = await supabase
        .from('departments')
        .select('name')
        .eq('company_id', user.company_id);
      setDepartments(deps?.map((d: any) => d.name) || []);
    };
    loadCompany();
  }, [router]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCustomFieldChange = (field: string, value: string) => {
    setForm({ ...form, custom_fields: { ...form.custom_fields, [field]: value } });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id)
      .eq('status', 'active');
    if (
      form.status === 'active' &&
      count >= company.maxemployees &&
      !(isEdit && employee && employee.status === 'active')
    ) {
      alert('Limite de funcionários atingido.');
      return;
    }
    const payload = { ...form, company_id: company.id };
    if (isEdit && employee) {
      await supabase.from('employees').update(payload).eq('id', employee.id);
    } else {
      await supabase.from('employees').insert(payload);
    }
    router.push('/employees');
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>{isEdit ? 'Editar Funcionário' : 'Novo Funcionário'}</h1>
      <input name="name" placeholder="Nome" value={form.name} onChange={handleChange} />
      <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
      <input name="phone" placeholder="Telefone" value={form.phone} onChange={handleChange} />
      <input name="cpf" placeholder="CPF/CNPJ" value={form.cpf} onChange={handleChange} />
      <input name="street" placeholder="Rua" value={form.street} onChange={handleChange} />
      <input name="city" placeholder="Cidade" value={form.city} onChange={handleChange} />
      <input name="state" placeholder="Estado" value={form.state} onChange={handleChange} />
      <input name="zip" placeholder="CEP" value={form.zip} onChange={handleChange} />
      <input name="position" placeholder="Cargo" value={form.position} onChange={handleChange} />
      <select name="department" value={form.department} onChange={handleChange}>
        <option value="">Departamento</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <input name="salary" placeholder="Salário" value={form.salary} onChange={handleChange} />
      <input name="hire_date" type="date" value={form.hire_date} onChange={handleChange} />
      <select name="status" value={form.status} onChange={handleChange}>
        <option value="active">Ativo</option>
        <option value="inactive">Inativo</option>
        <option value="dismissed">Desligado</option>
      </select>
      <input name="gender" placeholder="Gênero" value={form.gender} onChange={handleChange} />
      <input name="emergency_contact_name" placeholder="Contato Emergência" value={form.emergency_contact_name} onChange={handleChange} />
      <input name="emergency_contact_phone" placeholder="Telefone Emergência" value={form.emergency_contact_phone} onChange={handleChange} />
      <input name="emergency_contact_relation" placeholder="Relação" value={form.emergency_contact_relation} onChange={handleChange} />
      <input name="resume_url" placeholder="URL do Currículo" value={form.resume_url} onChange={handleChange} />
      <textarea name="comments" placeholder="Comentários" value={form.comments} onChange={handleChange} />
      {Object.entries(customFieldDefs).map(([field, options]) => (
        <div key={field}>
          <label>{field}</label>
          <select
            value={form.custom_fields[field] || ''}
            onChange={(e) => handleCustomFieldChange(field, e.target.value)}
          >
            <option value="">Selecione</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button type="submit">Salvar</button>
    </form>
  );
}
