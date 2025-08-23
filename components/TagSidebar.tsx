import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';

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
          <button onClick={onClose}>X</button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4 items-center">
          <Input
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="col-span-2"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-full p-0 border rounded"
          />
          <div className="col-span-3 flex justify-end">
            <Button onClick={add} disabled={!name} variant="outline">Adicionar</Button>
          </div>
        </div>
        {tags.map((t) => (
          <div key={t.id} className="grid grid-cols-6 gap-2 mb-2 items-center">
            <Input
              value={t.name}
              onChange={(e) => (t.name = e.target.value)}
              onBlur={() => save(t)}
              className="col-span-3"
            />
            <input
              type="color"
              value={t.color}
              onChange={(e) => {
                t.color = e.target.value;
                setTags([...tags]);
              }}
              onBlur={() => save(t)}
              className="col-span-2 h-10 p-0 border rounded"
            />
            <Button variant="outline" size="icon" onClick={() => remove(t.id)}>
              x
            </Button>
          </div>
        ))}
      </aside>
    </div>
  );
}
