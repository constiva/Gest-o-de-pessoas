import { Button } from './ui/button';

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
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
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
