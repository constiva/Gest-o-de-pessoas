import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import { X } from 'lucide-react';

interface Tag {
  name: string;
  color: string;
}

interface Props {
  talentId: string;
  applicationId: string;
  companyId: string;
  onClose: () => void;
}

export default function TalentModal({ talentId, applicationId, companyId, onClose }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newColor, setNewColor] = useState('#a855f7');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: talent } = await supabase
        .from('talents')
        .select('name,email,phone,source,talent_tag_map(tag:talent_tags(name,color))')
        .eq('id', talentId)
        .single();
      if (talent) {
        setName(talent.name);
        setEmail(talent.email);
        setPhone(talent.phone || '');
        setSource(talent.source || '');
        setTags(
          talent.talent_tag_map?.map((m: any) => ({
            name: m.tag.name,
            color: m.tag.color || '#a855f7',
          })) || [],
        );
      }
      const { data: app } = await supabase
        .from('applications')
        .select('notes')
        .eq('id', applicationId)
        .single();
      if (app) setNotes(app.notes || '');
    };
    if (talentId) load();
  }, [talentId, applicationId]);

  useEffect(() => {
    const loadTags = async () => {
      const { data } = await supabase
        .from('talent_tags')
        .select('name,color')
        .eq('company_id', companyId);
      setSuggestions(data as Tag[] || []);
    };
    if (companyId) loadTags();
  }, [companyId]);

  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    const existing = suggestions.find((s) => s.name === t);
    const color = existing ? existing.color : newColor;
    if (!tags.find((tag) => tag.name === t)) {
      setTags([...tags, { name: t, color }]);
    }
    setNewTag('');
    setNewColor('#a855f7');
  };

  const removeTag = (name: string) =>
    setTags(tags.filter((tag) => tag.name !== name));

  const save = async () => {
    const { error: tError } = await supabase
      .from('talents')
      .update({ name, email, phone, source })
      .eq('id', talentId);
    if (tError) {
      console.error(tError);
      alert(tError.message);
      return;
    }
    const { error: aError } = await supabase
      .from('applications')
      .update({ notes })
      .eq('id', applicationId);
    if (aError) {
      console.error(aError);
      alert(aError.message);
      return;
    }
    const { data: existing } = await supabase
      .from('talent_tags')
      .select('id,name,color')
      .eq('company_id', companyId);
    const tagIds: string[] = [];
    for (const tag of tags) {
      const found = existing?.find((e: any) => e.name === tag.name);
      if (found) {
        tagIds.push(found.id);
        if (found.color !== tag.color) {
          await supabase
            .from('talent_tags')
            .update({ color: tag.color })
            .eq('id', found.id);
        }
      } else {
        const { data: inserted } = await supabase
          .from('talent_tags')
          .insert({ company_id: companyId, name: tag.name, color: tag.color })
          .select('id')
          .single();
        if (inserted) tagIds.push(inserted.id);
      }
    }
    await supabase.from('talent_tag_map').delete().eq('talent_id', talentId);
    if (tagIds.length) {
      await supabase.from('talent_tag_map').insert(
        tagIds.map((id) => ({ talent_id: talentId, tag_id: id }))
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div className="bg-white rounded p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Talento</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 mb-4">
          <input
            className="w-full border p-2 rounded"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full border p-2 rounded"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full border p-2 rounded"
            placeholder="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <select
            className="w-full border p-2 rounded"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Fonte</option>
            <option value="career_site">Site</option>
            <option value="referral">Indicação</option>
            <option value="linkedin">LinkedIn</option>
            <option value="import">Importação</option>
            <option value="event">Evento</option>
            <option value="other">Outro</option>
          </select>
          <div>
            <div className="mb-1 font-medium">Tags</div>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((t) => (
                <span
                  key={t.name}
                  className="px-2 py-1 rounded text-xs flex items-center gap-1"
                  style={{ backgroundColor: t.color }}
                >
                  {t.name}
                  <button onClick={() => removeTag(t.name)}>×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input
                className="flex-1 border p-2 rounded"
                placeholder="Adicionar tag"
                value={newTag}
                list="tag-suggestions"
                onChange={(e) => {
                  const val = e.target.value;
                  setNewTag(val);
                  const found = suggestions.find((s) => s.name === val);
                  setNewColor(found?.color || '#a855f7');
                }}
              />
              <datalist id="tag-suggestions">
                {suggestions.map((s) => (
                  <option key={s.name} value={s.name} />
                ))}
              </datalist>
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-8 w-8 p-0 border rounded"
              />
              <Button type="button" size="sm" onClick={addTag}>
                Adicionar
              </Button>
            </div>
          </div>
          <textarea
            className="w-full border p-2 rounded"
            placeholder="Observações"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </div>
      </div>
    </div>
  );
}
