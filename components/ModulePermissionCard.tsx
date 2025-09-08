import Switch from './ui/switch';
import { Cog } from 'lucide-react';

interface Props {
  label: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  onConfig?: () => void;
}

export default function ModulePermissionCard({ label, enabled, onToggle, onConfig }: Props) {
  return (
    <div className="border rounded p-3 flex items-center justify-between w-full">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        {onConfig && (
          <button
            type="button"
            onClick={onConfig}
            disabled={!enabled}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            <Cog className="h-4 w-4" />
          </button>
        )}
        <Switch checked={enabled} onChange={onToggle} />
      </div>
    </div>
  );
}
