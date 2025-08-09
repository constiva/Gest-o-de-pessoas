import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs));
}

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
  resume_url: 'URL do currículo',
  comments: 'Comentários',
};

export function getFieldLabel(field: string) {
  return FIELD_LABELS[field] || field;
}
