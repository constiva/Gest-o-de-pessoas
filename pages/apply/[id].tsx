import { GetServerSideProps } from 'next';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface JobProps {
  job: { id: string; title: string; company_id: string; form_fields: string[] };
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
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: job.id, data: form }),
    });
    if (res.ok) setDone(true);
  };

  if (done) return <p>Obrigado! Inscrição recebida.</p>;

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{job.title}</h1>
      <form onSubmit={submit} className="space-y-4">
        {job.form_fields.map((field) => {
          const meta = fieldMeta[field];
          if (!meta) return null;
          return (
            <div key={field} className="flex flex-col">
              <label className="mb-1 font-medium">{meta.label}</label>
              {meta.type === 'select' ? (
                <select
                  required
                  className="border p-2 rounded"
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                />
              )}
            </div>
          );
        })}
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
    .select('id,title,company_id,form_fields')
    .eq('id', params?.id)
    .maybeSingle();
  if (!job) {
    return { notFound: true };
  }
  await supabase.rpc('increment_job_link_click', { j: job.id });
  return { props: { job } };
};
