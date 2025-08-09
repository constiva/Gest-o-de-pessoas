interface Props {
  active: number;
  inactive: number;
  dismissed: number;
}

export default function EmployeeStats({ active, inactive, dismissed }: Props) {
  const items = [
    { label: 'Funcionários ativos', value: active },
    { label: 'Funcionários inativos', value: inactive },
    { label: 'Funcionários desligados', value: dismissed },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 w-full max-w-2xl mx-auto">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white shadow rounded p-4 text-center"
        >
          <p className="text-sm text-gray-500">{item.label}</p>
          <p className="text-xl font-bold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
