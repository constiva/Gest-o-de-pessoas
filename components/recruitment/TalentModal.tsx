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
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [cvUrl, setCvUrl] = useState('');
  const [salary, setSalary] = useState('');
  const [seniority, setSeniority] = useState('');
  const [availability, setAvailability] = useState('');
  const [source, setSource] = useState('');
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState('');
  const COLOR_OPTIONS = [
    '#a855f7',
    '#6366f1',
    '#3b82f6',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#ec4899',
  ];
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [paletteFor, setPaletteFor] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: talent } = await supabase
        .from('talents')
        .select(
          'name,email,phone,city,state,cv_url,salary_expectation,seniority,availability,source,comment,talent_tag_map(tag:talent_tags(name,color))'
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
        setComment(talent.comment || '');
        setTags(
          talent.talent_tag_map?.map((m: any) => ({
            name: m.tag.name,
            color: m.tag.color || COLOR_OPTIONS[0],
          })) || []
        );
      }
    };
    if (talentId) load();
  }, [talentId]);

  useEffect(() => {
    const loadTags = async () => {
      const { data } = await supabase
        .from('talent_tags')
        .select('name,color')
        .eq('company_id', companyId);
      setSuggestions((data as Tag[]) || []);
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
    setNewColor(COLOR_OPTIONS[0]);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div className="bg-white rounded p-4 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Talento</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 mb-4">
          <input
            className="w-full border p-2 rounded sm:col-span-2"
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
          <input
            className="w-full border p-2 rounded"
            placeholder="Cidade"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <input
            className="w-full border p-2 rounded"
            placeholder="Estado"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
          <input
            className="w-full border p-2 rounded sm:col-span-2"
            placeholder="URL do currículo"
            value={cvUrl}
            onChange={(e) => setCvUrl(e.target.value)}
          />
          <input
            type="number"
            className="w-full border p-2 rounded"
            placeholder="Pretensão salarial"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
          />
          <input
            className="w-full border p-2 rounded"
            placeholder="Senioridade"
            value={seniority}
            onChange={(e) => setSeniority(e.target.value)}
          />
          <input
            className="w-full border p-2 rounded"
            placeholder="Disponibilidade"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
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
          <div className="sm:col-span-2">
            <div className="mb-1 font-medium">Tags</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((t) => (
                <div key={t.name} className="relative">
                  <span
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
                  <button
                    type="button"
                    className="absolute -right-1 -top-1 h-3 w-3 rounded-full border"
                    style={{ backgroundColor: t.color }}
                    onClick={() =>
                      setPaletteFor(paletteFor === t.name ? null : t.name)
                    }
                  />
                  {paletteFor === t.name && (
                    <div className="absolute z-10 top-full right-0 mt-1 flex gap-1 bg-white p-2 shadow rounded">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="h-4 w-4 rounded-full border"
                          style={{ backgroundColor: c }}
                          onClick={() => {
                            setTags(
                              tags.map((tag) =>
                                tag.name === t.name ? { ...tag, color: c } : tag
                              )
                            );
                            setPaletteFor(null);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="flex-1 border p-2 rounded"
                placeholder="Adicionar tag"
                value={newTag}
                list="tag-suggestions"
                onChange={(e) => {
                  const val = e.target.value;
                  setNewTag(val);
                  const found = suggestions.find((s) => s.name === val);
                  setNewColor(found?.color || COLOR_OPTIONS[0]);
                }}
              />
              <datalist id="tag-suggestions">
                {suggestions.map((s) => (
                  <option key={s.name} value={s.name} />
                ))}
              </datalist>
              <div className="relative">
                <button
                  type="button"
                  className="h-6 w-6 rounded-full border"
                  style={{ backgroundColor: newColor }}
                  onClick={() =>
                    setPaletteFor(paletteFor === 'new' ? null : 'new')
                  }
                />
                {paletteFor === 'new' && (
                  <div className="absolute z-10 mt-1 flex gap-1 bg-white p-2 shadow rounded">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="h-6 w-6 rounded-full border"
                        style={{ backgroundColor: c }}
                        onClick={() => {
                          setNewColor(c);
                          setPaletteFor(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <Button type="button" size="sm" onClick={addTag}>
                Adicionar
              </Button>
            </div>
          </div>
          <textarea
            className="w-full border p-2 rounded"
            placeholder="Observações"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
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
