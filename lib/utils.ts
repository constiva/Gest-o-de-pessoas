import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs));
}

export const PLAN_LIMITS = {
  free: 5,
  pro: 50,
  enterprise: 500,
} as const;

export const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  email: 'E-mail',
  phone: 'Telefone',
  cpf: 'CPF/CNPJ',
  birth_date: 'Data de nascimento',
  street: 'Rua',
  zip: 'CEP',
  city: 'Cidade',
  state: 'Estado',
  position: 'Cargo',
  department: 'Departamento',
  unit: 'Filial',
  salary: 'Salário',
  hire_date: 'Data de admissão',
  termination_date: 'Data de desligamento',
  termination_reason: 'Motivo do desligamento',
  status: 'Status',
  gender: 'Gênero',
};

export function getFieldLabel(field: string) {
  return FIELD_LABELS[field] || field;
}

export const FIELD_GROUPS = [
  {
    title: 'Informações pessoais',
    fields: ['gender'],
  },
  { title: 'Endereço', fields: ['street', 'city', 'state', 'zip'] },
  {
    title: 'Informações profissionais',
    fields: ['position', 'department', 'unit', 'salary', 'hire_date', 'status'],
  },
];

export const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  dismissed: 'Desligado',
};

export function getStatusLabel(status: string) {
  return STATUS_LABELS[status] || status;
}
