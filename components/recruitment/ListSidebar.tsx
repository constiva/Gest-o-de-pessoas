import { useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Plus, X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  items: string[];
  onClose: () => void;
  onSave: (items: string[]) => void;
}

export default function ListSidebar({ open, title, items, onClose, onSave }: Props) {
  const [list, setList] = useState<string[]>(items);

  useEffect(() => {
    if (open) {
      setList(items);
    }
  }, [open, items]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative bg-white w-96 h-full p-4 overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose}>X</button>
        </div>
        {list.map((val, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <Input
              value={val}
              onChange={(e) => {
                const arr = [...list];
                arr[i] = e.target.value;
                setList(arr);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                const arr = [...list];
                arr.splice(i, 1);
                setList(arr);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setList([...list, ''])}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => {
              onSave(list.filter((v) => v.trim() !== ''));
              onClose();
            }}
          >
            Salvar
          </Button>
        </div>
      </aside>
    </div>
  );
}

