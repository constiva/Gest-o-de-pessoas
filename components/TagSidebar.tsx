import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
}

export default function TagSidebar({ open, onClose, companyId }: Props) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#a855f7');

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data } = await supabase
        .from('talent_tags')
        .select('id,name,color')
        .eq('company_id', companyId);
      setTags((data as Tag[]) || []);
    };
    load();
  }, [open, companyId]);

  const add = async () => {
    const { data, error } = await supabase
      .from('talent_tags')
      .insert({ company_id: companyId, name, color })
      .select('id,name,color')
      .single();
    if (!error && data) {
      setTags([...tags, data as Tag]);
      setName('');
    }
  };

  const save = async (tag: Tag) => {
    await supabase
      .from('talent_tags')
      .update({ name: tag.name, color: tag.color })
      .eq('id', tag.id);
  };

  const remove = async (id: string) => {
    await supabase.from('talent_tags').delete().eq('id', id);
    setTags(tags.filter((t) => t.id !== id));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative bg-white w-80 h-full p-4 overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Tags</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="text-sm font-medium mb-2">Adicionar tag</h3>
        <div className="flex items-center gap-2 mb-4">
          <Input
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-6 border rounded-full cursor-pointer"
          />
          <Button onClick={add} disabled={!name} variant="outline" size="icon">
            +
          </Button>
        </div>
        {tags.length > 0 && (
          <h3 className="text-sm font-medium mb-2">Editar tags</h3>
        )}
        {tags.map((t) => (
          <div key={t.id} className="flex items-center gap-2 mb-2">
            <Input
              value={t.name}
              onChange={(e) => (t.name = e.target.value)}
              onBlur={() => save(t)}
              className="flex-1"
            />
            <input
              type="color"
              value={t.color}
              onChange={(e) => {
                t.color = e.target.value;
                setTags([...tags]);
              }}
              onBlur={() => save(t)}
              className="h-6 w-6 border rounded-full cursor-pointer"
            />
            <Button variant="outline" size="icon" onClick={() => remove(t.id)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </aside>
    </div>
  );
}
