import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Settings } from 'lucide-react';
import CustomFieldSidebar from './CustomFieldSidebar';
import DepartmentSidebar from './DepartmentSidebar';
import PositionSidebar from './PositionSidebar';

interface Employee {
  id?: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birth_date: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  position: string;
  department: string;
  unit: string;
  salary: string;
  hire_date: string;
  status: string;
  gender: string;
  custom_fields: Record<string, string>;
  company_id?: string;
}

const defaultEmployee: Employee = {
  name: '',
  email: '',
  phone: '',
  cpf: '',
  birth_date: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  position: '',
  department: '',
  unit: '',
  salary: '',
  hire_date: '',
  status: 'active',
  gender: '',
  custom_fields: {},
};

export default function EmployeeForm({ employee }: { employee?: Employee }) {
  const [form, setForm] = useState<Employee>(employee ? { ...employee, custom_fields: employee.custom_fields || {} } : defaultEmployee);
  const router = useRouter();
  const isEdit = !!employee;
  const [company, setCompany] = useState<any>(null);
  const [customFieldDefs, setCustomFieldDefs] = useState<Record<string, string[]>>({});
  const [departments, setDepartments] = useState<string[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm({
        ...employee,
        birth_date: employee.birth_date || '',
        phone: formatPhone(employee.phone || ''),
        cpf: formatCpfCnpj(employee.cpf || ''),
        salary: employee.salary ? formatCurrency(Number(employee.salary)) : '',
        custom_fields: employee.custom_fields || {},
      });
    } else {
      setForm(defaultEmployee);
    }
  }, [employee]);

  const formatCpfCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length > 10) {
      return digits.replace(/(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    }
    return digits.replace(/(\d{2})(\d{4})(\d{4}).*/, '($1) $2-$3');
  };

  const formatCurrency = (value: number | string) => {
    const number =
      typeof value === 'number'
        ? value
        : Number(
            value
              .replace(/\./g, '')
              .replace(',', '.')
              .replace(/[^0-9.]/g, '')
          );
    if (isNaN(number)) return '';
    return number.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  const parseCurrency = (value: string) => {
    if (!value) return null;
    return Number(
      value
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^0-9.]/g, '')
    );
  };
  const loadOptions = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    let companyId = '';
    let unitName = '';
    const { data: user } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', session.user.id)
      .maybeSingle();
    if (user) {
      companyId = user.company_id;
    } else {
      const { data: compUser } = await supabase
        .from('companies_users')
        .select('company_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (compUser) {
        companyId = compUser.company_id;
      } else {
        const { data: unitUser } = await supabase
          .from('companies_units')
          .select('company_id,name')
          .eq('user_id', session.user.id)
          .maybeSingle();
        companyId = unitUser?.company_id || '';
        unitName = unitUser?.name || '';
        setForm((f) => ({ ...f, unit: unitName }));
      }
    }
    if (!companyId) return;
    const { data: comp } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();
    setCompany(comp);
    const { data: defs } = await supabase
      .from('custom_fields')
      .select('field,value')
      .eq('company_id', companyId);
    const map: Record<string, string[]> = {};
    defs?.forEach((d: any) => {
      map[d.field] = map[d.field] ? [...map[d.field], d.value] : [d.value];
    });
    setCustomFieldDefs(map);
    const { data: deps } = await supabase
      .from('departments')
      .select('name')
      .eq('company_id', companyId);
    setDepartments(deps?.map((d: any) => d.name) || []);
    const { data: poss } = await supabase
      .from('positions')
      .select('name')
      .eq('company_id', companyId);
    setPositions(poss?.map((p: any) => p.name) || []);
    if (unitName) {
      setUnits([]);
    } else {
      const { data: unitRows } = await supabase
        .from('companies_units')
        .select('name')
        .eq('company_id', companyId);
      setUnits(unitRows?.map((u: any) => u.name) || []);
    }
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
    const payload = {
      ...form,
      salary: parseCurrency(form.salary) || null,
      unit: form.unit || null,
      company_id: company.id,
      hire_date: form.hire_date || new Date().toISOString().slice(0, 10),
    };
    if (isEdit && employee) {
      await supabase.from('employees').update(payload).eq('id', employee.id);
    } else {
      await supabase.from('employees').insert(payload);
    }
    if (form.status === 'active') {
      const { count: newCount } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('status', 'active');
      if (newCount > company.maxemployees) {
        await supabase
          .from('companies')
          .update({ maxemployees: newCount })
          .eq('id', company.id);
        setCompany({ ...company, maxemployees: newCount });
      }
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
        <h2 className="font-semibold mb-4">Dados do funcionário</h2>
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
              placeholder="Ex: (11) 99999-9999"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: formatPhone(e.target.value) })
              }
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="cpf">CPF/CNPJ</label>
            <Input
              id="cpf"
              name="cpf"
              placeholder="Ex: 123.456.789-00"
              value={form.cpf}
              onChange={(e) =>
                setForm({ ...form, cpf: formatCpfCnpj(e.target.value) })
              }
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="birth_date">Data de nascimento</label>
            <Input
              id="birth_date"
              name="birth_date"
              type="date"
              value={form.birth_date}
              onChange={handleChange}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold mb-4">Informações pessoais</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col">
            <label htmlFor="gender">Gênero</label>
            <select
              id="gender"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              className="border p-2 rounded"
            >
              <option value="">Selecione</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="outros">Outros</option>
            </select>
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
              placeholder="Ex: Rua das Flores"
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
              placeholder="Ex: 00000-000"
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
            <div className="flex items-center gap-2">
              <select
                id="position"
                name="position"
                value={form.position}
                onChange={handleChange}
                className="border p-2 rounded flex-1"
              >
                <option value="">Selecione</option>
                {positions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPosOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
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
          {units.length > 0 && (
            <div className="flex flex-col">
              <label htmlFor="unit">Filial</label>
              <select
                id="unit"
                name="unit"
                value={form.unit}
                onChange={handleChange}
                className="border p-2 rounded"
              >
                <option value="">Selecione</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col">
            <label htmlFor="salary">Salário</label>
            <Input
              id="salary"
              name="salary"
              placeholder="Ex: R$ 3.500,00"
              value={form.salary}
              onChange={(e) =>
                setForm({ ...form, salary: formatCurrency(e.target.value) })
              }
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
      <PositionSidebar
        open={posOpen}
        onClose={() => {
          setPosOpen(false);
          loadOptions();
        }}
      />
    </>
  );
}
