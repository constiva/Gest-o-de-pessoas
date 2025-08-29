import { GetServerSideProps } from 'next';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface JobProps {
  job: {
    id: string;
    title: string;
    company_id: string;
    form_fields: string[];
    custom_fields: CustomField[];
    form_field_order: string[];
  };
}

interface CustomField {
  id: string;
  label: string;
  type: string;
  options?: string[];
  enabled?: boolean;
}

const fieldMeta: Record<string, { label: string; type: string; options?: { value: string; label: string }[] }> = {
  name: { label: 'Nome', type: 'text' },
  email: { label: 'Email', type: 'email' },
  phone: { label: 'Telefone', type: 'text' },
  city: { label: 'Cidade', type: 'text' },
  state: { label: 'Estado', type: 'text' },
  cv_url: { label: 'Currículo URL', type: 'text' },
  salary_expectation: { label: 'Pretensão salarial', type: 'number' },
  seniority: { label: 'Senioridade', type: 'text' },
  availability: { label: 'Disponibilidade', type: 'text' },
  source: {
    label: 'Origem',
    type: 'select',
    options: [
      { value: 'career_site', label: 'Site' },
      { value: 'referral', label: 'Indicação' },
      { value: 'linkedin', label: 'LinkedIn' },
      { value: 'import', label: 'Importação' },
      { value: 'event', label: 'Evento' },
      { value: 'other', label: 'Outro' },
    ],
  },
};

export default function Apply({ job }: JobProps) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, any>>({});
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: job.id, data: form, custom }),
    });
    if (res.ok) setDone(true);
  };

  if (done) return <p>Obrigado! Inscrição recebida.</p>;

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{job.title}</h1>
      <form onSubmit={submit} className="space-y-4">
        {(() => {
          const order = job.form_field_order || [];
          const builtins = new Set(job.form_fields);
          const customMap: Record<string, CustomField> = {};
          job.custom_fields
            .filter((f) => f.enabled !== false)
            .forEach((f) => (customMap[f.id] = f));
          const fieldMap = new Map<string, { type: 'builtin' | 'custom' }>();
          builtins.forEach((id) => fieldMap.set(id, { type: 'builtin' }));
          Object.keys(customMap).forEach((id) =>
            fieldMap.set(id, { type: 'custom' })
          );
          const ordered: { id: string; type: 'builtin' | 'custom' }[] = [];
          order.forEach((id) => {
            const entry = fieldMap.get(id);
            if (entry) {
              ordered.push({ id, type: entry.type });
              fieldMap.delete(id);
            }
          });
          fieldMap.forEach((val, id) => ordered.push({ id, type: val.type }));
          return ordered.map((item) => {
            if (item.type === 'builtin') {
              const meta = fieldMeta[item.id];
              if (!meta) return null;
              return (
                <div key={item.id} className="flex flex-col">
                  <label className="mb-1 font-medium">{meta.label}</label>
                  {meta.type === 'select' ? (
                    <select
                      required
                      className="border p-2 rounded"
                      onChange={(e) =>
                        setForm({ ...form, [item.id]: e.target.value })
                      }
                    >
                      <option value="">Selecione</option>
                      {meta.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={meta.type}
                      required
                      className="border p-2 rounded"
                      onChange={(e) =>
                        setForm({ ...form, [item.id]: e.target.value })
                      }
                    />
                  )}
                </div>
              );
            }
            const field = customMap[item.id];
            if (!field) return null;
            return (
              <div key={field.id} className="flex flex-col">
                <label className="mb-1 font-medium">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="border p-2 rounded"
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
                          onChange={(e) => {
                            const prev = custom[field.id] || [];
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
                    className="border p-2 rounded"
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
                    className="border p-2 rounded"
                    onChange={(e) => {
                      const selected = Array.from(
                        e.target.selectedOptions
                      ).map((o) => o.value);
                      setCustom({ ...custom, [field.id]: selected });
                    }}
                  >
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="border p-2 rounded"
                    onChange={(e) =>
                      setCustom({ ...custom, [field.id]: e.target.value })
                    }
                  />
                )}
              </div>
            );
          });
        })()}
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
          Enviar
        </button>
      </form>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
  const { data: job } = await supabase
    .from('jobs')
    .select('id,title,company_id,form_fields,custom_fields,form_field_order')
    .eq('id', params?.id)
    .maybeSingle();
  if (!job) {
    return { notFound: true };
  }
  await supabase.rpc('increment_job_link_click', { j: job.id });
  return { props: { job } };
};
