import { X } from 'lucide-react';
import { Button } from './ui/button';
import { getFieldLabel, FIELD_GROUPS } from '../lib/utils';

type Granularity = 'day' | 'week' | 'month' | 'year';

interface Props {
  open: boolean;
  onClose: () => void;
  groupBy: string;
  setGroupBy: (val: string) => void;
  start: string;
  setStart: (val: string) => void;
  end: string;
  setEnd: (val: string) => void;
  granularity: Granularity;
  setGranularity: (val: Granularity) => void;
  filterSalary: boolean;
  setFilterSalary: (val: boolean) => void;
  salaryMin: string;
  setSalaryMin: (val: string) => void;
  salaryMax: string;
  setSalaryMax: (val: string) => void;
}

export default function HeadcountConfigModal({
  open,
  onClose,
  groupBy,
  setGroupBy,
  start,
  setStart,
  end,
  setEnd,
  granularity,
  setGranularity,
  filterSalary,
  setFilterSalary,
  salaryMin,
  setSalaryMin,
  salaryMax,
  setSalaryMax,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-md w-full max-w-sm p-4 shadow-xl dark:bg-gray-900">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Agrupar por</label>
            <select
              className="border border-gray-300 rounded-md p-2 text-sm w-full dark:bg-gray-800 dark:border-gray-700"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="">Todos</option>
              {FIELD_GROUPS.map((g) => (
                <optgroup key={g.title} label={g.title}>
                  {g.fields.map((f) => (
                    <option key={f} value={f}>
                      {getFieldLabel(f)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={filterSalary}
                onChange={(e) => {
                  setFilterSalary(e.target.checked);
                  if (!e.target.checked) {
                    setSalaryMin('');
                    setSalaryMax('');
                  }
                }}
              />
              Filtrar por salário
            </label>
          </div>
          {filterSalary && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Salário mín.</label>
                <input
                  type="number"
                  className="border border-gray-300 rounded-md p-2 text-sm w-full dark:bg-gray-800 dark:border-gray-700"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Salário máx.</label>
                <input
                  type="number"
                  className="border border-gray-300 rounded-md p-2 text-sm w-full dark:bg-gray-800 dark:border-gray-700"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                />
              </div>
            </div>
          )}
          {granularity !== 'year' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Início</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded-md p-2 text-sm w-full dark:bg-gray-800 dark:border-gray-700"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fim</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded-md p-2 text-sm w-full dark:bg-gray-800 dark:border-gray-700"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Granularidade</label>
            <select
              className="border border-gray-300 rounded-md p-2 text-sm w-full dark:bg-gray-800 dark:border-gray-700"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as Granularity)}
            >
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mês</option>
              <option value="year">Ano</option>
            </select>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

