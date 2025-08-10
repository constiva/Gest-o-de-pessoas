import { Users, UserMinus, UserX } from 'lucide-react';

interface Props {
  active: number;
  inactive: number;
  dismissed: number;
}

export default function EmployeeStats({ active, inactive, dismissed }: Props) {
  const items = [
    {
      label: 'Funcionários ativos',
      value: active,
      icon: Users,
      color: 'text-emerald-500',
    },
    {
      label: 'Funcionários inativos',
      value: inactive,
      icon: UserMinus,
      color: 'text-amber-500',
    },
    {
      label: 'Funcionários desligados',
      value: dismissed,
      icon: UserX,
      color: 'text-rose-500',
    },
  ];
  return (
    <div className="grid gap-6 sm:grid-cols-3 w-full max-w-4xl mx-auto mb-8">
      {items.map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="flex items-center gap-4 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md"
        >
          <div className={`p-3 rounded-lg bg-brand/10 ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
