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
import { Card } from '../../../components/ui/card';
import { getSourceLabel } from '../../../lib/utils';
import { Plus, X } from 'lucide-react';

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
  const [workMode, setWorkMode] = useState<'remote' | 'onsite' | 'hybrid'>('remote');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [contractOptions, setContractOptions] = useState<string[]>([
    'CLT',
    'PJ',
    'Estágio',
    'Trainee',
    'Menor Aprendiz',
  ]);
  const [newContract, setNewContract] = useState('');
  const [showMsg, setShowMsg] = useState(false);

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
          const jobData = data as Job;
          if (jobData.work_location) {
            if (jobData.work_location === 'remote') {
              setWorkMode('remote');
              jobData.work_location = '';
            } else if (jobData.work_location.includes('|')) {
              const [mode, addr] = jobData.work_location.split('|');
              setWorkMode(mode as 'remote' | 'onsite' | 'hybrid');
              jobData.work_location = addr;
            }
          }
          if (jobData.salary_range) {
            const [min, max] = jobData.salary_range.split('-');
            setSalaryMin(min || '');
            setSalaryMax(max || '');
          }
          if (jobData.workload) {
            const m = jobData.workload.match(/\d+/);
            jobData.workload = m ? m[0] : jobData.workload;
          }
          setJob(jobData);
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
              <div className="space-y-4">
                <Card className="p-4 space-y-2">
                  <h2 className="font-medium">Informações principais</h2>
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
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={job.sla || ''}
                          onChange={(e) => setJob({ ...job, sla: e.target.value })}
                        />
                        {job.opened_at && job.sla && (
                          <span className="text-sm text-gray-600">
                            {Math.ceil(
                              (new Date(job.sla).getTime() -
                                new Date(job.opened_at).getTime()) /
                                (1000 * 60 * 60 * 24)
                            )}{' '}
                            dias
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm">Local de trabalho</label>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          {[
                            { id: 'onsite', label: 'Presencial' },
                            { id: 'remote', label: 'Home Office' },
                            { id: 'hybrid', label: 'Híbrido' },
                          ].map((opt) => (
                            <label key={opt.id} className="flex items-center gap-1">
                              <input
                                type="radio"
                                name="workmode"
                                value={opt.id}
                                checked={workMode === opt.id}
                                onChange={() => setWorkMode(opt.id as any)}
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                        {workMode !== 'remote' && (
                          <Input
                            placeholder="Endereço"
                            value={job.work_location || ''}
                            onChange={(e) => setJob({ ...job, work_location: e.target.value })}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 space-y-2">
                  <h2 className="font-medium">Descrição da oportunidade</h2>
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
                      {(job.responsibilities || []).map((r, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <Input
                            value={r}
                            onChange={(e) => {
                              const arr = [...(job.responsibilities || [])];
                              arr[i] = e.target.value;
                              setJob({ ...job, responsibilities: arr });
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const arr = [...(job.responsibilities || [])];
                              arr.splice(i, 1);
                              setJob({ ...job, responsibilities: arr });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setJob({
                            ...job,
                            responsibilities: [...(job.responsibilities || []), ''],
                          })
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm">Requisitos obrigatórios</label>
                      {(job.requirements || []).map((r, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <Input
                            value={r}
                            onChange={(e) => {
                              const arr = [...(job.requirements || [])];
                              arr[i] = e.target.value;
                              setJob({ ...job, requirements: arr });
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const arr = [...(job.requirements || [])];
                              arr.splice(i, 1);
                              setJob({ ...job, requirements: arr });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setJob({
                            ...job,
                            requirements: [...(job.requirements || []), ''],
                          })
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm">Diferenciais desejáveis</label>
                      {(job.desirables || []).map((r, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <Input
                            value={r}
                            onChange={(e) => {
                              const arr = [...(job.desirables || [])];
                              arr[i] = e.target.value;
                              setJob({ ...job, desirables: arr });
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const arr = [...(job.desirables || [])];
                              arr.splice(i, 1);
                              setJob({ ...job, desirables: arr });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setJob({
                            ...job,
                            desirables: [...(job.desirables || []), ''],
                          })
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 space-y-2">
                  <h2 className="font-medium">Informações estratégicas</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-sm">Faixa salarial</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Mínimo"
                          value={salaryMin}
                          onChange={(e) => setSalaryMin(e.target.value)}
                        />
                        <Input
                          placeholder="Máximo"
                          value={salaryMax}
                          onChange={(e) => setSalaryMax(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm">Tipo de contrato</label>
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          {contractOptions.map((opt) => (
                            <div
                              key={opt}
                              className={`flex items-center gap-1 border rounded px-2 py-1 text-sm ${
                                job.contract_type === opt
                                  ? 'bg-blue-600 text-white'
                                  : ''
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setJob({ ...job, contract_type: opt })}
                              >
                                {opt}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setContractOptions(
                                    contractOptions.filter((o) => o !== opt)
                                  )
                                }
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Adicionar tipo"
                            value={newContract}
                            onChange={(e) => setNewContract(e.target.value)}
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              if (!newContract) return;
                              setContractOptions([...contractOptions, newContract]);
                              setNewContract('');
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm">Carga horária</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={job.workload || ''}
                          onChange={(e) => setJob({ ...job, workload: e.target.value })}
                        />
                        <span className="text-sm">horas semanais</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm">Nível de senioridade</label>
                      <select
                        className="border p-2 rounded w-full"
                        value={job.seniority || ''}
                        onChange={(e) => setJob({ ...job, seniority: e.target.value })}
                      >
                        <option value="">--</option>
                        <option value="junior">Junior</option>
                        <option value="pleno">Pleno</option>
                        <option value="senior">Senior</option>
                        <option value="especialista">Especialista</option>
                      </select>
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
                </Card>

                <Card className="p-4 space-y-2">
                  <h2 className="font-medium">Insights da vaga</h2>
                  <p>Quantidade de candidatos inscritos: {candidateCount}</p>
                  <ul className="list-disc list-inside">
                    {Object.entries(sourceDist).map(([src, count]) => (
                      <li key={src}>
                        {getSourceLabel(src)}: {count}
                      </li>
                    ))}
                  </ul>
                </Card>

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
                      work_location:
                        workMode === 'remote'
                          ? 'remote'
                          : `${workMode}|${job.work_location || ''}`,
                      summary: job.summary,
                      responsibilities: job.responsibilities,
                      requirements: job.requirements,
                      desirables: job.desirables,
                      salary_range:
                        salaryMin || salaryMax
                          ? `${salaryMin}-${salaryMax}`
                          : null,
                      benefits: job.benefits,
                      contract_type: job.contract_type,
                      workload: job.workload
                        ? `${job.workload} horas semanais`
                        : null,
                      seniority: job.seniority,
                    };
                    const { error } = await supabase
                      .from('jobs')
                      .update(payload)
                      .eq('id', id);
                    if (error) {
                      console.error(error);
                      alert(error.message);
                    } else {
                      setShowMsg(true);
                      setTimeout(() => setShowMsg(false), 3000);
                    }
                  }}
                >
                  Salvar
                </Button>
                {showMsg && (
                  <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-800 px-4 py-2 rounded">
                    Alterações salvas com sucesso
                  </div>
                )}
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
