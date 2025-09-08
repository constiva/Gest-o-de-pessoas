import { Button } from './ui/button';
import Switch from './ui/switch';

interface Props {
  label: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  onConfig?: () => void;
}

export default function ModulePermissionCard({ label, enabled, onToggle, onConfig }: Props) {
  return (
    <div className="border rounded p-3 flex flex-col gap-2 w-48">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <Switch checked={enabled} onChange={onToggle} />
      </div>
      {onConfig && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onConfig}
          disabled={!enabled}
        >
          Configurar
        </Button>
      )}
    </div>
  );
}
