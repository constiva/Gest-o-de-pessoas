interface Props {
  active: number;
  inactive: number;
  dismissed: number;
}

export default function EmployeeStats({ active, inactive, dismissed }: Props) {
  return (
    <div>
      <p>Funcionários ativos: {active}</p>
      <p>Funcionários inativos: {inactive}</p>
      <p>Funcionários desligados: {dismissed}</p>
    </div>
  );
}
