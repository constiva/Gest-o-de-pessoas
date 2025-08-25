import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import { X, Settings } from 'lucide-react';
import TagSidebar from '../TagSidebar';

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
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [cvUrl, setCvUrl] = useState('');
  const [salary, setSalary] = useState('');
  const [seniority, setSeniority] = useState('');
  const [availability, setAvailability] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('active');
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newColor, setNewColor] = useState('#a855f7');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [tagOpen, setTagOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: talent } = await supabase
        .from('talents')
        .select(
          'name,email,phone,city,state,cv_url,salary_expectation,seniority,availability,source,status,comment,talent_tag_map(tag:talent_tags(name,color))'
        )
        .eq('id', talentId)
        .single();
      if (talent) {
        setName(talent.name);
        setEmail(talent.email);
        setPhone(talent.phone || '');
        setCity(talent.city || '');
        setState(talent.state || '');
        setCvUrl(talent.cv_url || '');
        setSalary(talent.salary_expectation?.toString() || '');
        setSeniority(talent.seniority || '');
        setAvailability(talent.availability || '');
        setSource(talent.source || '');
        setStatus(talent.status || 'active');
        setComment(talent.comment || '');
        setTags(
          talent.talent_tag_map?.map((m: any) => ({
            name: m.tag.name,
            color: m.tag.color || '#a855f7',
          })) || []
        );
      }
    };
    if (talentId) load();
  }, [talentId]);

  const refreshTags = async () => {
    const { data } = await supabase
      .from('talent_tags')
      .select('name,color')
      .eq('company_id', companyId);
    const list = (data as Tag[]) || [];
    setSuggestions(list);
    setTags((prev) =>
      prev.map((t) => {
        const found = list.find((s) => s.name === t.name);
        return found ? { ...t, color: found.color } : t;
      })
    );
  };

  useEffect(() => {
    if (companyId) refreshTags();
  }, [companyId]);

  const handleTagClose = () => {
    setTagOpen(false);
    refreshTags();
  };

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
      .update({
        name,
        email,
        phone,
        city,
        state,
        cv_url: cvUrl,
        salary_expectation: salary ? Number(salary) : null,
        seniority,
        availability,
        source,
        status,
        comment,
      })
      .eq('id', talentId);
    if (tError) {
      console.error(tError);
      alert(tError.message);
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
      await supabase
        .from('talent_tag_map')
        .insert(tagIds.map((id) => ({ talent_id: talentId, tag_id: id })));
    }
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
        <div className="bg-white rounded p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Talento</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              className="w-full border p-2 rounded"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              className="w-full border p-2 rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Telefone</label>
            <input
              className="w-full border p-2 rounded"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cidade</label>
            <input
              className="w-full border p-2 rounded"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Estado</label>
            <input
              className="w-full border p-2 rounded"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">URL do currículo</label>
            <input
              className="w-full border p-2 rounded"
              value={cvUrl}
              onChange={(e) => setCvUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pretensão salarial</label>
            <input
              type="number"
              className="w-full border p-2 rounded"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Senioridade</label>
            <input
              className="w-full border p-2 rounded"
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Disponibilidade</label>
            <input
              className="w-full border p-2 rounded"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fonte</label>
            <select
              className="w-full border p-2 rounded appearance-none pr-6"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Selecione</option>
              <option value="career_site">Site</option>
              <option value="referral">Indicação</option>
              <option value="linkedin">LinkedIn</option>
              <option value="import">Importação</option>
              <option value="event">Evento</option>
              <option value="other">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <div className="space-y-2">
              {[
                { value: 'active', label: 'Ativo' },
                { value: 'withdrawn', label: 'Desistente' },
                { value: 'rejected', label: 'Reprovado' },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="status"
                    value={opt.value}
                    checked={status === opt.value}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-4 w-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium">Tags</div>
              <Button type="button" variant="outline" size="icon" onClick={() => setTagOpen(true)}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((t) => (
                <span
                  key={t.name}
                  className="px-2 py-1 rounded text-xs flex items-center gap-1"
                  style={{
                    color: t.color,
                    backgroundColor: `${t.color}33`,
                    fontWeight: 'bold',
                  }}
                >
                  {t.name}
                  <button onClick={() => removeTag(t.name)}>×</button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1">
                <input
                  className="w-full border p-2 rounded appearance-none"
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
              </div>
              <datalist id="tag-suggestions">
                {suggestions.map((s) => (
                  <option key={s.name} value={s.name} />
                ))}
              </datalist>
              <input
                type="color"
                className="h-6 w-6 border rounded-full cursor-pointer"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
              />
              <Button type="button" size="sm" onClick={addTag}>
                Adicionar
              </Button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Observações</label>
            <textarea
              className="w-full border p-2 rounded"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </div>
        </div>
      </div>
      <TagSidebar
        open={tagOpen}
        onClose={handleTagClose}
        companyId={companyId}
      />
    </>
  );
}
