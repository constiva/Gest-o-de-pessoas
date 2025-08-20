import { ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const ChartContainer = forwardRef<HTMLDivElement, {
  children: ReactNode;
  className?: string;
}>(({ children, className }, ref) => {
  return (
    <div ref={ref} className={cn('h-[350px] w-full', className)}>
      {children}
    </div>
  );
});
ChartContainer.displayName = 'ChartContainer';

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md border bg-white px-2 py-1 text-xs shadow-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: p.fill }}
          />
          <span>
            {(p.name || p.dataKey) + ': ' + (p.percent !== undefined ? `${(p.percent * 100).toFixed(1)}%` : p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

