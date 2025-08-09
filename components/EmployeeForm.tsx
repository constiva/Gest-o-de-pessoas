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
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-xl font-bold">
        {isEdit ? 'Editar Funcionário' : 'Novo Funcionário'}
      </h1>

      <section>
        <h2 className="font-semibold mb-2">Informações pessoais</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="name">Nome completo</label>
            <input
              id="name"
              name="name"
              placeholder="Ex: João da Silva"
              value={form.name}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="exemplo@empresa.com"
              value={form.email}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="phone">Telefone</label>
            <input
              id="phone"
              name="phone"
              placeholder="Ex: 11 99999-9999"
              value={form.phone}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="cpf">CPF/CNPJ</label>
            <input
              id="cpf"
              name="cpf"
              placeholder="Ex: 123.456.789-00"
              value={form.cpf}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="gender">Gênero</label>
            <input
              id="gender"
              name="gender"
              placeholder="Ex: Feminino"
              value={form.gender}
              onChange={handleChange}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Endereço</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="street">Rua</label>
            <input
              id="street"
              name="street"
              placeholder="Ex: Av. Paulista, 1000"
              value={form.street}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="city">Cidade</label>
            <input
              id="city"
              name="city"
              placeholder="Ex: São Paulo"
              value={form.city}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="state">Estado</label>
            <input
              id="state"
              name="state"
              placeholder="Ex: SP"
              value={form.state}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="zip">CEP</label>
            <input
              id="zip"
              name="zip"
              placeholder="Ex: 01234-567"
              value={form.zip}
              onChange={handleChange}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Informações profissionais</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="position">Cargo</label>
            <input
              id="position"
              name="position"
              placeholder="Ex: Analista de RH"
              value={form.position}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="department">Departamento</label>
            <select
              id="department"
              name="department"
              value={form.department}
              onChange={handleChange}
            >
              <option value="">Selecione</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="salary">Salário</label>
            <input
              id="salary"
              name="salary"
              placeholder="Ex: 3500"
              value={form.salary}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="hire_date">Data de admissão</label>
            <input
              id="hire_date"
              name="hire_date"
              type="date"
              value={form.hire_date}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="dismissed">Desligado</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Contato de emergência</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="emergency_contact_name">Nome</label>
            <input
              id="emergency_contact_name"
              name="emergency_contact_name"
              placeholder="Ex: Maria Silva"
              value={form.emergency_contact_name}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="emergency_contact_phone">Telefone</label>
            <input
              id="emergency_contact_phone"
              name="emergency_contact_phone"
              placeholder="Ex: 11 98888-7777"
              value={form.emergency_contact_phone}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="emergency_contact_relation">Relação</label>
            <input
              id="emergency_contact_relation"
              name="emergency_contact_relation"
              placeholder="Ex: Mãe"
              value={form.emergency_contact_relation}
              onChange={handleChange}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Outros</h2>
        <div className="grid gap-2">
          <div className="flex flex-col">
            <label htmlFor="resume_url">URL do currículo</label>
            <input
              id="resume_url"
              name="resume_url"
              placeholder="https://exemplo.com/curriculo.pdf"
              value={form.resume_url}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="comments">Comentários</label>
            <textarea
              id="comments"
              name="comments"
              placeholder="Observações adicionais"
              value={form.comments}
              onChange={handleChange}
            />
          </div>
        </div>
      </section>

      {Object.entries(customFieldDefs).length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">Campos personalizados</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(customFieldDefs).map(([field, options]) => (
              <div key={field} className="flex flex-col">
                <label htmlFor={`cf-${field}`}>{field}</label>
                <select
                  id={`cf-${field}`}
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
          </div>
        </section>
      )}

      <button type="submit">Salvar</button>
    </form>
  );
}
