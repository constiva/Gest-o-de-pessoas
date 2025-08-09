import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Settings } from 'lucide-react';
import CustomFieldSidebar from './CustomFieldSidebar';
import DepartmentSidebar from './DepartmentSidebar';

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
  const [fieldOpen, setFieldOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);

  useEffect(() => {
    setForm(employee ? { ...employee, custom_fields: employee.custom_fields || {} } : defaultEmployee);
  }, [employee]);
  const loadOptions = async () => {
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

  useEffect(() => {
    loadOptions();
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
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-xl font-bold">
        {isEdit ? 'Editar Funcionário' : 'Novo Funcionário'}
      </h1>

      <Card>
        <h2 className="font-semibold mb-4">Informações pessoais</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="name">Nome completo</label>
            <Input
              id="name"
              name="name"
              placeholder="Ex: João da Silva"
              value={form.name}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="email">Email</label>
            <Input
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
            <Input
              id="phone"
              name="phone"
              placeholder="Ex: 11 99999-9999"
              value={form.phone}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="cpf">CPF/CNPJ</label>
            <Input
              id="cpf"
              name="cpf"
              placeholder="Ex: 123.456.789-00"
              value={form.cpf}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="gender">Gênero</label>
            <Input
              id="gender"
              name="gender"
              placeholder="Ex: Feminino"
              value={form.gender}
              onChange={handleChange}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-4">Endereço</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="street">Rua</label>
            <Input
              id="street"
              name="street"
              placeholder="Ex: Av. Paulista, 1000"
              value={form.street}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="city">Cidade</label>
            <Input
              id="city"
              name="city"
              placeholder="Ex: São Paulo"
              value={form.city}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="state">Estado</label>
            <Input
              id="state"
              name="state"
              placeholder="Ex: SP"
              value={form.state}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="zip">CEP</label>
            <Input
              id="zip"
              name="zip"
              placeholder="Ex: 01234-567"
              value={form.zip}
              onChange={handleChange}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-4">Informações profissionais</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="position">Cargo</label>
            <Input
              id="position"
              name="position"
              placeholder="Ex: Analista de RH"
              value={form.position}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="department">Departamento</label>
            <div className="flex items-center gap-2">
              <select
                id="department"
                name="department"
                value={form.department}
                onChange={handleChange}
                className="border p-2 rounded flex-1"
              >
                <option value="">Selecione</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeptOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col">
            <label htmlFor="salary">Salário</label>
            <Input
              id="salary"
              name="salary"
              placeholder="Ex: 3500"
              value={form.salary}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="hire_date">Data de admissão</label>
            <Input
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
              className="border p-2 rounded"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="dismissed">Desligado</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-4">Contato de emergência</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="emergency_contact_name">Nome</label>
            <Input
              id="emergency_contact_name"
              name="emergency_contact_name"
              placeholder="Ex: Maria Silva"
              value={form.emergency_contact_name}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="emergency_contact_phone">Telefone</label>
            <Input
              id="emergency_contact_phone"
              name="emergency_contact_phone"
              placeholder="Ex: 11 98888-7777"
              value={form.emergency_contact_phone}
              onChange={handleChange}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="emergency_contact_relation">Relação</label>
            <Input
              id="emergency_contact_relation"
              name="emergency_contact_relation"
              placeholder="Ex: Mãe"
              value={form.emergency_contact_relation}
              onChange={handleChange}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-4">Outros</h2>
        <div className="grid gap-2">
          <div className="flex flex-col">
            <label htmlFor="resume_url">URL do currículo</label>
            <Input
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
              className="border p-2 rounded"
            />
          </div>
        </div>
      </Card>

      {Object.entries(customFieldDefs).length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Campos personalizados</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFieldOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(customFieldDefs).map(([field, options]) => (
              <div key={field} className="flex flex-col">
                <label htmlFor={`cf-${field}`}>{field}</label>
                <select
                  id={`cf-${field}`}
                  value={form.custom_fields[field] || ''}
                  onChange={(e) => handleCustomFieldChange(field, e.target.value)}
                  className="border p-2 rounded"
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
        </Card>
      )}

        <Button type="submit">Salvar</Button>
      </form>
      <CustomFieldSidebar
        open={fieldOpen}
        onClose={() => {
          setFieldOpen(false);
          loadOptions();
        }}
      />
      <DepartmentSidebar
        open={deptOpen}
        onClose={() => {
          setDeptOpen(false);
          loadOptions();
        }}
      />
    </>
  );
}
