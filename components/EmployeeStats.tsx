interface Props {
  active: number;
  inactive: number;
  dismissed: number;
}

export default function EmployeeStats({ active, inactive, dismissed }: Props) {
  return (
    <div className="flex space-x-4 mb-4">
      <p className="text-sm">Funcionários ativos: {active}</p>
      <p className="text-sm">Funcionários inativos: {inactive}</p>
      <p className="text-sm">Funcionários desligados: {dismissed}</p>
    </div>
  );
}
