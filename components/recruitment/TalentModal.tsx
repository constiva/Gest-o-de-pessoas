import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import { X } from 'lucide-react';

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
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: talent } = await supabase
        .from('talents')
        .select('name,email,phone,source,talent_tag_map(tag:talent_tags(name))')
        .eq('id', talentId)
        .single();
      if (talent) {
        setName(talent.name);
        setEmail(talent.email);
        setPhone(talent.phone || '');
        setSource(talent.source || '');
        setTags(talent.talent_tag_map?.map((m: any) => m.tag.name) || []);
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

  const addTag = () => {
    const t = newTag.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setNewTag('');
  };

  const removeTag = (t: string) => setTags(tags.filter((tag) => tag !== t));

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
      .select('id,name')
      .eq('company_id', companyId);
    const tagIds: string[] = [];
    for (const tagName of tags) {
      const found = existing?.find((e: any) => e.name === tagName);
      if (found) tagIds.push(found.id);
      else {
        const { data: inserted } = await supabase
          .from('talent_tags')
          .insert({ company_id: companyId, name: tagName })
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
                  key={t}
                  className="px-2 py-1 bg-purple-100 rounded text-xs flex items-center gap-1"
                >
                  {t}
                  <button onClick={() => removeTag(t)}>×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 border p-2 rounded"
                placeholder="Adicionar tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
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
