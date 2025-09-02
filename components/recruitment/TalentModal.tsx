import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import { X, Settings, ChevronDown } from 'lucide-react';
import TagSidebar from '../TagSidebar';

interface Tag {
  name: string;
  color: string;
}

interface CustomField {
  id: string;
  label: string;
  type: string;
  options?: string[];
  enabled?: boolean;
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
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('active');
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newColor, setNewColor] = useState('#a855f7');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [tagOpen, setTagOpen] = useState(false);
  const [custom, setCustom] = useState<Record<string, any>>({});
  const [orderedFields, setOrderedFields] = useState<
    { id: string; type: 'builtin' | 'custom' }[]
  >([]);
  const [customMap, setCustomMap] = useState<Record<string, CustomField>>({});
  const [wide, setWide] = useState<Set<string>>(new Set());

  const fieldMeta: Record<
    string,
    { label: string; type: string; options?: { value: string; label: string }[] }
  > = {
    name: { label: 'Nome', type: 'text' },
    email: { label: 'Email', type: 'email' },
    phone: { label: 'Telefone', type: 'text' },
    city: { label: 'Cidade', type: 'text' },
    state: { label: 'Estado', type: 'text' },
    cv_url: { label: 'Currículo (PDF)', type: 'text' },
    salary_expectation: { label: 'Pretensão salarial', type: 'number' },
    seniority: { label: 'Senioridade', type: 'text' },
    source: {
      label: 'Origem do talento',
      type: 'select',
      options: [
        { value: 'career_site', label: 'Site' },
        { value: 'referral', label: 'Indicação' },
        { value: 'linkedin', label: 'LinkedIn' },
        { value: 'import', label: 'Importação' },
        { value: 'event', label: 'Evento' },
        { value: 'instagram', label: 'Instagram' },
        { value: 'internal_referral', label: 'Indicação interna' },
        { value: 'other', label: 'Outro' },
      ],
    },
  };

  const builtinValues: Record<string, [string, (v: string) => void]> = {
    name: [name, setName],
    email: [email, setEmail],
    phone: [phone, setPhone],
    city: [city, setCity],
    state: [state, setState],
    cv_url: [cvUrl, setCvUrl],
    salary_expectation: [salary, setSalary],
    seniority: [seniority, setSeniority],
    source: [source, setSource],
  };

  useEffect(() => {
    const load = async () => {
      const { data: talent } = await supabase
        .from('talents')
        .select(
          'name,email,phone,city,state,cv_url,salary_expectation,seniority,source,status,comment,talent_tag_map(tag:talent_tags(name,color))'
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

  useEffect(() => {
    const load = async () => {
      const { data: app } = await supabase
        .from('applications')
        .select('job_id, custom_answers')
        .eq('id', applicationId)
        .maybeSingle();
      if (!app) return;
      setCustom(app.custom_answers || {});
      const { data: job } = await supabase
        .from('jobs')
        .select(
          'form_fields, custom_fields, form_field_order, form_field_wide'
        )
        .eq('id', app.job_id)
        .maybeSingle();
      if (!job) return;
      // include all built-in fields regardless of visibility on the public form
      const builtins = new Set<string>(Object.keys(fieldMeta));
      const cMap: Record<string, CustomField> = {};
      // show custom fields even if they are disabled on the public form
      (job.custom_fields || []).forEach((f: CustomField) => {
        cMap[f.id] = f;
      });
      const fieldMap = new Map<string, { type: 'builtin' | 'custom' }>();
      builtins.forEach((id) => fieldMap.set(id, { type: 'builtin' }));
      Object.keys(cMap).forEach((id) => fieldMap.set(id, { type: 'custom' }));
      const order: string[] = job.form_field_order || [];
      const ordered: { id: string; type: 'builtin' | 'custom' }[] = [];
      order.forEach((id) => {
        const entry = fieldMap.get(id);
        if (entry) {
          ordered.push({ id, type: entry.type });
          fieldMap.delete(id);
        }
      });
      fieldMap.forEach((val, id) => ordered.push({ id, type: val.type }));
      setOrderedFields(ordered);
      setCustomMap(cMap);
      setWide(new Set(job.form_field_wide || []));
    };
    if (applicationId) load();
  }, [applicationId]);

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
        phone: phone || null,
        city: city || null,
        state: state || null,
        cv_url: cvUrl || null,
        salary_expectation: salary ? Number(salary) : null,
        seniority: seniority || null,
        source: source || null,
        status,
        comment: comment || null,
      })
      .eq('id', talentId);
    if (tError) {
      console.error(tError);
      alert(tError.message);
      return;
    }
    const { error: aError } = await supabase
      .from('applications')
      .update({ custom_answers: custom })
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
          {orderedFields.map((item) => {
            if (item.type === 'builtin') {
              const meta = fieldMeta[item.id];
              if (!meta) return null;
              const [val, setVal] = builtinValues[item.id] || ['', () => {}];
              const full = wide.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex flex-col ${full ? 'sm:col-span-2' : ''}`}
                >
                  <label className="block text-sm font-medium mb-1">
                    {meta.label}
                  </label>
                  {meta.type === 'select' ? (
                    <div className="relative">
                      <select
                        className="w-full border p-2 rounded appearance-none pr-8"
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {meta.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                    </div>
                  ) : (
                    <input
                      type={meta.type}
                      className="w-full border p-2 rounded"
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                    />
                  )}
                </div>
              );
            }
            const field = customMap[item.id];
            if (!field) return null;
            const value = custom[field.id];
            const full =
              wide.has(field.id) ||
              field.type === 'textarea' ||
              field.type === 'radio' ||
              field.type === 'checkbox' ||
              field.type === 'multiselect';
            return (
              <div
                key={field.id}
                className={`flex flex-col ${full ? 'sm:col-span-2' : ''}`}
              >
                <label className="block text-sm font-medium mb-1">
                  {field.label}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="w-full border p-2 rounded"
                    value={value || ''}
                    onChange={(e) =>
                      setCustom({ ...custom, [field.id]: e.target.value })
                    }
                  />
                ) : field.type === 'radio' ? (
                  <div className="space-y-1">
                    {field.options?.map((opt) => (
                      <label key={opt} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={field.id}
                          value={opt}
                          checked={value === opt}
                          onChange={(e) =>
                            setCustom({ ...custom, [field.id]: e.target.value })
                          }
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : field.type === 'checkbox' ? (
                  <div className="space-y-1">
                    {field.options?.map((opt) => (
                      <label key={opt} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          value={opt}
                          checked={(value || []).includes(opt)}
                          onChange={(e) => {
                            const prev = value || [];
                            const checked = e.target.checked;
                            setCustom({
                              ...custom,
                              [field.id]: checked
                                ? [...prev, opt]
                                : prev.filter((x: string) => x !== opt),
                            });
                          }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : field.type === 'select' ? (
                  <select
                    className="w-full border p-2 rounded"
                    value={value || ''}
                    onChange={(e) =>
                      setCustom({ ...custom, [field.id]: e.target.value })
                    }
                  >
                    <option value="">Selecione</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'multiselect' ? (
                  <select
                    multiple
                    className="w-full border p-2 rounded"
                    value={value || []}
                    onChange={(e) =>
                      setCustom({
                        ...custom,
                        [field.id]: Array.from(
                          e.target.selectedOptions,
                          (o) => o.value
                        ),
                      })
                    }
                  >
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-full border p-2 rounded"
                    value={value || ''}
                    onChange={(e) =>
                      setCustom({ ...custom, [field.id]: e.target.value })
                    }
                  />
                )}
              </div>
            );
          })}
          <div className="sm:col-span-2">
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
                    className="h-4 w-4 accent-brand"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div className="font-medium">Tags</div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setTagOpen(true)}
              >
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
              <div className="flex-1 relative">
                <input
                  className="w-full border p-2 rounded appearance-none pr-8"
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
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
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
