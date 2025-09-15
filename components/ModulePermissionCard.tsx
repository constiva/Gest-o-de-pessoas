import Switch from './ui/switch';
import { Button } from './ui/button';
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
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onConfig}
            disabled={!enabled}
            aria-label="Configurar"
          >
            <Cog className="h-4 w-4" />
          </Button>
        )}
        <Switch checked={enabled} onChange={onToggle} />
      </div>
    </div>
  );
}
