export const SCOPE_DEFINITIONS: Record<string, Record<string, string>> = {
  employees: {
    read: 'Listar funcionários',
    create: 'Criar funcionário',
    update: 'Editar funcionário',
    update_salary: 'Atualizar salário',
    dismiss: 'Desligar funcionário',
    activate: 'Ativar funcionário',
    deactivate: 'Inativar funcionário',
    delete: 'Excluir funcionário',
    export: 'Exportar funcionários',
  },
  metrics: {
    read: 'Ver métricas',
  },
  reports: {
    read: 'Ver relatórios',
    export: 'Exportar relatórios',
  },
};

export const EMPLOYEE_FIELD_OPTIONS: Record<string, string> = {
  name: 'Nome',
  email: 'E-mail',
  phone: 'Telefone',
  position: 'Cargo',
  salary: 'Salário',
  cpf: 'CPF/CNPJ',
};

export type Scopes = Record<string, Record<string, boolean>>;

export function hasScope(
  scopes: Scopes | undefined,
  module: string,
  action: string
): boolean {
  return Boolean(scopes?.[module]?.[action]);
}
