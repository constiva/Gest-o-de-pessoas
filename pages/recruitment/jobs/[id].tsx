import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import JobTalentBoard from '../../../components/recruitment/JobTalentBoard';
import { supabase } from '../../../lib/supabaseClient';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { getSourceLabel } from '../../../lib/utils';

interface Job {
  id: string;
  company_id: string;
  title: string;
  department: string | null;
  manager_id: string | null;
  status: string;
  opened_at: string | null;
  sla: string | null;
  work_location: string | null;
  summary: string | null;
  responsibilities: string[] | null;
  requirements: string[] | null;
  desirables: string[] | null;
  salary_range: string | null;
  benefits: string | null;
  contract_type: string | null;
  workload: string | null;
  seniority: string | null;
  form_fields: string[] | null;
}

export default function JobDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState<Job | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [managers, setManagers] = useState<{ user_id: string; name: string }[]>([]);
  const [candidateCount, setCandidateCount] = useState(0);
  const [sourceDist, setSourceDist] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!id || Array.isArray(id)) return;
    supabase
      .from('jobs')
      .select(
        'id,company_id,title,department,manager_id,status,opened_at,sla,work_location,summary,responsibilities,requirements,desirables,salary_range,benefits,contract_type,workload,seniority,form_fields'
      )
      .eq('id', id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          setJob(data as Job);
          setFields((data.form_fields as string[]) || ['name', 'email']);
          const { data: mgrs } = await supabase
            .from('companies_users')
            .select('user_id,name')
            .eq('company_id', data.company_id);
          setManagers(mgrs || []);
          const { data: apps } = await supabase
            .from('applications')
            .select('source')
            .eq('job_id', id);
          if (apps) {
            setCandidateCount(apps.length);
            const dist: Record<string, number> = {};
            apps.forEach((a) => {
              const key = a.source || 'other';
              dist[key] = (dist[key] || 0) + 1;
            });
            setSourceDist(dist);
          }
        }
      });
  }, [id]);

  const talentFields = [
    { id: 'name', label: 'Nome' },
    { id: 'email', label: 'Email' },
    { id: 'phone', label: 'Telefone' },
    { id: 'city', label: 'Cidade' },
    { id: 'state', label: 'Estado' },
    { id: 'cv_url', label: 'Currículo URL' },
    { id: 'salary_expectation', label: 'Pretensão salarial' },
    { id: 'seniority', label: 'Senioridade' },
    { id: 'availability', label: 'Disponibilidade' },
  ];

  const saveFields = async () => {
    if (!id || Array.isArray(id)) return;
    const { error } = await supabase
      .from('jobs')
      .update({ form_fields: fields })
      .eq('id', id);
    if (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const publicLink =
    typeof window !== 'undefined' && id
      ? `${window.location.origin}/apply/${id}`
      : '';

  return (
    <>
      <Head>
        <title>{job ? job.title : 'Vaga'} - Recrutamento</title>
      </Head>
      <Layout>
        <Link href="/recruitment" className="text-sm text-blue-600 hover:underline">
          &larr; Voltar para Vagas
        </Link>
        <h1 className="text-2xl font-bold mt-2 mb-4">{job?.title || 'Vaga'}</h1>
        <Tabs defaultValue="talents">
          <TabsList className="mb-4">
            <TabsTrigger value="talents">Talentos</TabsTrigger>
            <TabsTrigger value="about">Sobre a vaga</TabsTrigger>
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
            <TabsTrigger value="ads">Divulgação</TabsTrigger>
            <TabsTrigger value="settings">Roteiro</TabsTrigger>
          </TabsList>
          <TabsContent value="talents">
            {id && !Array.isArray(id) && <JobTalentBoard jobId={id} />}
          </TabsContent>
          <TabsContent value="about">
            {job && (
              <div className="space-y-6">
                <section>
                  <h2 className="font-medium mb-2">Informações principais</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-sm">Título</label>
                      <Input
                        value={job.title}
                        onChange={(e) => setJob({ ...job, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm">Departamento</label>
                      <Input
                        value={job.department || ''}
                        onChange={(e) => setJob({ ...job, department: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm">Gestor responsável</label>
                      <select
                        className="border p-2 rounded w-full"
                        value={job.manager_id || ''}
                        onChange={(e) => setJob({ ...job, manager_id: e.target.value })}
                      >
                        <option value="">--</option>
                        {managers.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm">Status</label>
                      <select
                        className="border p-2 rounded w-full"
                        value={job.status}
                        onChange={(e) => setJob({ ...job, status: e.target.value })}
                      >
                        <option value="open">Aberta</option>
                        <option value="frozen">Congelada</option>
                        <option value="closed">Fechada</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm">Data de abertura</label>
                      <Input
                        type="date"
                        value={job.opened_at || ''}
                        onChange={(e) => setJob({ ...job, opened_at: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm">Prazo estimado</label>
                      <Input
                        type="date"
                        value={job.sla || ''}
                        onChange={(e) => setJob({ ...job, sla: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm">Local de trabalho</label>
                      <Input
                        value={job.work_location || ''}
                        onChange={(e) => setJob({ ...job, work_location: e.target.value })}
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="font-medium mb-2">Descrição da oportunidade</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-sm">Resumo</label>
                      <textarea
                        className="w-full border rounded p-2"
                        rows={3}
                        value={job.summary || ''}
                        onChange={(e) => setJob({ ...job, summary: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm">Responsabilidades principais</label>
                      <textarea
                        className="w-full border rounded p-2"
                        rows={4}
                        value={(job.responsibilities || []).join('\n')}
                        onChange={(e) =>
                          setJob({ ...job, responsibilities: e.target.value.split('\n') })
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm">Requisitos obrigatórios</label>
                      <textarea
                        className="w-full border rounded p-2"
                        rows={4}
                        value={(job.requirements || []).join('\n')}
                        onChange={(e) =>
                          setJob({ ...job, requirements: e.target.value.split('\n') })
                        }
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm">Diferenciais desejáveis</label>
                      <textarea
                        className="w-full border rounded p-2"
                        rows={4}
                        value={(job.desirables || []).join('\n')}
                        onChange={(e) =>
                          setJob({ ...job, desirables: e.target.value.split('\n') })
                        }
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="font-medium mb-2">Informações estratégicas</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-sm">Faixa salarial / benefícios</label>
                      <Input
                        value={job.salary_range || ''}
                        onChange={(e) => setJob({ ...job, salary_range: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm">Tipo de contrato</label>
                      <Input
                        value={job.contract_type || ''}
                        onChange={(e) => setJob({ ...job, contract_type: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm">Carga horária</label>
                      <Input
                        value={job.workload || ''}
                        onChange={(e) => setJob({ ...job, workload: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm">Nível de senioridade</label>
                      <Input
                        value={job.seniority || ''}
                        onChange={(e) => setJob({ ...job, seniority: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm">Benefícios</label>
                      <textarea
                        className="w-full border rounded p-2"
                        rows={3}
                        value={job.benefits || ''}
                        onChange={(e) => setJob({ ...job, benefits: e.target.value })}
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="font-medium mb-2">Insights da vaga</h2>
                  <p>Quantidade de candidatos inscritos: {candidateCount}</p>
                  <ul className="list-disc list-inside">
                    {Object.entries(sourceDist).map(([src, count]) => (
                      <li key={src}>
                        {getSourceLabel(src)}: {count}
                      </li>
                    ))}
                  </ul>
                </section>

                <Button
                  onClick={async () => {
                    if (!id || Array.isArray(id) || !job) return;
                    const payload = {
                      title: job.title,
                      department: job.department,
                      manager_id: job.manager_id,
                      status: job.status,
                      opened_at: job.opened_at,
                      sla: job.sla,
                      work_location: job.work_location,
                      summary: job.summary,
                      responsibilities: job.responsibilities,
                      requirements: job.requirements,
                      desirables: job.desirables,
                      salary_range: job.salary_range,
                      benefits: job.benefits,
                      contract_type: job.contract_type,
                      workload: job.workload,
                      seniority: job.seniority,
                    };
                    const { error } = await supabase
                      .from('jobs')
                      .update(payload)
                      .eq('id', id);
                    if (error) {
                      console.error(error);
                      alert(error.message);
                    }
                  }}
                >
                  Salvar
                </Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="metrics">
            <p>Métricas em construção.</p>
          </TabsContent>
          <TabsContent value="ads">
            <div className="space-y-4">
              <div>
                <p className="font-medium mb-2">Campos do formulário público</p>
                {talentFields.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={fields.includes(f.id)}
                      onChange={(e) => {
                        setFields(
                          e.target.checked
                            ? [...fields, f.id]
                            : fields.filter((x) => x !== f.id)
                        );
                      }}
                    />
                    {f.label}
                  </label>
                ))}
                <button
                  onClick={saveFields}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Salvar
                </button>
              </div>
              {publicLink && (
                <div>
                  <p className="font-medium">Link público da vaga</p>
                  <input
                    readOnly
                    value={publicLink}
                    className="w-full border p-2 rounded"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="settings">
            <p>Roteiro em construção.</p>
          </TabsContent>
        </Tabs>
      </Layout>
    </>
  );
}
