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
  street: 'Rua',
  city: 'Cidade',
  state: 'Estado',
  zip: 'CEP',
  position: 'Cargo',
  department: 'Departamento',
  salary: 'Salário',
  hire_date: 'Data de admissão',
  termination_date: 'Data de desligamento',
  termination_reason: 'Motivo do desligamento',
  status: 'Status',
  gender: 'Gênero',
  emergency_contact_name: 'Contato de emergência (nome)',
  emergency_contact_phone: 'Contato de emergência (telefone)',
  emergency_contact_relation: 'Contato de emergência (relação)',
  resume_url: 'Currículo',
  comments: 'Comentários',
};

export function getFieldLabel(field: string) {
  return FIELD_LABELS[field] || field;
}

export const FIELD_GROUPS = [
  {
    title: 'Informações pessoais',
    fields: ['name', 'email', 'phone', 'cpf', 'gender'],
  },
  { title: 'Endereço', fields: ['street', 'city', 'state', 'zip'] },
  {
    title: 'Informações profissionais',
    fields: ['position', 'department', 'salary', 'hire_date', 'status'],
  },
  {
    title: 'Contato de emergência',
    fields: [
      'emergency_contact_name',
      'emergency_contact_phone',
      'emergency_contact_relation',
    ],
  },
  { title: 'Outros', fields: ['resume_url', 'comments'] },
];
