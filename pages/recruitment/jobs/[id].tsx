import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import JobTalentBoard from '../../../components/recruitment/JobTalentBoard';
import JobMetrics from '../../../components/recruitment/JobMetrics';
import RoteiroTab from '../../../components/recruitment/RoteiroTab';
import { supabase } from '../../../lib/supabaseClient';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Plus, X, GripVertical } from 'lucide-react';
import ListSidebar from '../../../components/recruitment/ListSidebar';

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
  custom_fields: CustomField[] | null;
  form_field_order: string[] | null;
  form_field_wide: string[] | null;
  form_config_id: string | null;
}

interface CustomField {
  id: string;
  label: string;
  type: string;
  options?: string[];
  enabled?: boolean;
}

export default function JobDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState<Job | null>(null);
  interface FormFieldItem {
    id: string;
    label: string;
    type?: string;
    options?: string[];
    enabled: boolean;
    isCustom: boolean;
    span: number;
  }
  const [fieldList, setFieldList] = useState<FormFieldItem[]>([]);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [cfType, setCfType] = useState('text');
  const [cfLabel, setCfLabel] = useState('');
  const [cfOptions, setCfOptions] = useState<string[]>(['']);
  const [managers, setManagers] = useState<{ user_id: string; name: string }[]>([]);
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
  const [showMsg, setShowMsg] = useState(false);
  const [fieldsMsg, setFieldsMsg] = useState(false);
  const [applyFormMsg, setApplyFormMsg] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [listEditor, setListEditor] = useState<
    | 'responsibilities'
    | 'requirements'
    | 'desirables'
    | 'contracts'
    | null
  >(null);

  const handleListSave = (items: string[]) => {
    if (!job) return;
    if (listEditor === 'responsibilities') {
      setJob({ ...job, responsibilities: items });
    } else if (listEditor === 'requirements') {
      setJob({ ...job, requirements: items });
    } else if (listEditor === 'desirables') {
      setJob({ ...job, desirables: items });
    } else if (listEditor === 'contracts') {
      setContractOptions(items);
      if (!items.includes(job.contract_type || '')) {
        setJob({ ...job, contract_type: null });
      }
    }
  };

  interface FormConfig {
    id: string;
    name: string;
    config: FormFieldItem[];
  }
  const [forms, setForms] = useState<FormConfig[]>([]);
  const [formName, setFormName] = useState('');
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);

  const Toggle = ({
    on,
    onChange,
  }: {
    on: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${on ? 'bg-purple-600' : 'bg-gray-300'}`}
    >
      <span
        className={`bg-white w-4 h-4 rounded-full transform transition ${on ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );

  useEffect(() => {
    if (job) {
      loadForms(job.company_id, job.form_config_id);
    }
  }, [job?.company_id, job?.form_config_id]);

  async function loadForms(companyId: string, selected?: string | null) {
    const { data } = await supabase
      .from('job_form_configs')
      .select('id,name,config')
      .eq('company_id', companyId);
    if (data) {
      setForms(data as any);
      if (selected) {
        const f = data.find((fc: any) => fc.id === selected);
        if (f) {
          setCurrentFormId(f.id);
          setFormName(f.name);
        }
      } else if (data.length && !currentFormId) {
        const f = data[0] as any;
        setCurrentFormId(f.id);
        setFormName(f.name);
        const cfg = f.config as FormFieldItem[];
        setFieldList(cfg);
        applyConfig(cfg, f.id);
      }
    }
  }

  async function selectForm(fid: string) {
    const f = forms.find((fc) => fc.id === fid);
    if (!f) return;
    setCurrentFormId(f.id);
    setFormName(f.name);
    const cfg = f.config as FormFieldItem[];
    setFieldList(cfg);
    const ok = await applyConfig(cfg, f.id);
    if (ok) {
      setApplyFormMsg(`Formulário ${f.name} aplicado à vaga ${job?.title || ''}`);
      setTimeout(() => setApplyFormMsg(''), 3000);
    }
  }

  async function applyConfig(cfg: FormFieldItem[], formId?: string) {
    if (!id || Array.isArray(id)) return false;
    const builtins = cfg
      .filter((f) => !f.isCustom && f.enabled)
      .map((f) => f.id);
    const custom = cfg
      .filter((f) => f.isCustom)
      .map(({ id, label, type, options, enabled }) => ({
        id,
        label,
        type: type!,
        options,
        enabled,
      }));
    const order = cfg.map((f) => f.id);
    const wide = cfg.filter((f) => f.span === 2).map((f) => f.id);
    const update: any = {
      form_fields: builtins,
      custom_fields: custom,
      form_field_order: order,
      form_field_wide: wide,
    };
    if (formId) update.form_config_id = formId;
    const { error } = await supabase.from('jobs').update(update).eq('id', id);
    if (!error) {
      setJob((prev) =>
        prev
          ? {
              ...prev,
              form_fields: builtins,
              custom_fields: custom as any,
              form_field_order: order,
              form_field_wide: wide,
              form_config_id: formId ?? prev.form_config_id,
            }
          : prev
      );
      return true;
    }
    return false;
  }

  useEffect(() => {
    if (!id || Array.isArray(id)) return;
    supabase
      .from('jobs')
      .select(
        'id,company_id,title,department,manager_id,status,opened_at,sla,work_location,summary,responsibilities,requirements,desirables,salary_range,benefits,contract_type,workload,seniority,form_fields,custom_fields,form_field_order,form_field_wide,form_config_id'
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
          const builtins = (data.form_fields as string[]) || ['name', 'email'];
          const customDefs = ((data.custom_fields as CustomField[]) || []).map(
            (f) => ({ ...f, enabled: f.enabled ?? true })
          );
          const order = (data.form_field_order as string[]) || [];
          const wideSet = new Set((data.form_field_wide as string[]) || []);
          const builtinItems = talentFields.map((tf) => ({
            id: tf.id,
            label: tf.label,
            isCustom: false,
            enabled: builtins.includes(tf.id),
            span: wideSet.has(tf.id) ? 2 : 1,
          }));
          const customItems = customDefs.map((cf) => ({
            id: cf.id,
            label: cf.label,
            type: cf.type,
            options: cf.options,
            enabled: cf.enabled !== false,
            isCustom: true,
            span:
              wideSet.has(cf.id) ||
              ['textarea', 'radio', 'checkbox', 'multiselect'].includes(cf.type)
                ? 2
                : 1,
          }));
          const map = new Map(
            [...builtinItems, ...customItems].map((f) => [f.id, f])
          );
          const ordered: FormFieldItem[] = [];
          order.forEach((id: string) => {
            const item = map.get(id);
            if (item) {
              ordered.push(item);
              map.delete(id);
            }
          });
          map.forEach((item) => ordered.push(item));
          setFieldList(ordered);
          const { data: mgrs } = await supabase
            .from('companies_users')
            .select('user_id,name')
            .eq('company_id', data.company_id);
          setManagers(mgrs || []);
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
    { id: 'source', label: 'Onde você nos encontrou?' },
  ];

  const createFormConfig = async () => {
    if (!id || Array.isArray(id)) return;
    if (!formName.trim()) return;
    if (forms.some((f) => f.name === formName.trim())) {
      alert('Já existe um formulário com esse nome');
      return;
    }
    const builtins = fieldList
      .filter((f) => !f.isCustom && f.enabled)
      .map((f) => f.id);
    const custom = fieldList
      .filter((f) => f.isCustom)
      .map(({ id, label, type, options, enabled }) => ({
        id,
        label,
        type: type!,
        options,
        enabled,
      }));
    const order = fieldList.map((f) => f.id);
    const wide = fieldList.filter((f) => f.span === 2).map((f) => f.id);

    const { data: saved, error: cfgErr } = await supabase
      .from('job_form_configs')
      .insert({
        company_id: job?.company_id,
        name: formName.trim(),
        config: fieldList,
      })
      .select()
      .single();
    if (cfgErr) {
      console.error(cfgErr);
      alert(cfgErr.message);
      return;
    }
    setForms([...forms, saved]);
    setCurrentFormId(saved.id);

    const { error } = await supabase
      .from('jobs')
      .update({
        form_fields: builtins,
        custom_fields: custom,
        form_field_order: order,
        form_field_wide: wide,
        form_config_id: saved.id,
      })
      .eq('id', id);
    if (error) {
      console.error(error);
      alert(error.message);
    } else {
      setFieldsMsg(true);
      setTimeout(() => setFieldsMsg(false), 3000);
      setJob((prev) =>
        prev
          ? {
              ...prev,
              form_fields: builtins,
              custom_fields: custom as any,
              form_field_order: order,
              form_field_wide: wide,
              form_config_id: saved.id,
            }
          : prev
      );
    }
  };

  const deleteFormConfig = async (fid: string) => {
    await supabase.from('job_form_configs').delete().eq('id', fid);
    setForms(forms.filter((f) => f.id !== fid));
    if (currentFormId === fid) {
      setCurrentFormId(null);
      setFormName('');
      await supabase.from('jobs').update({ form_config_id: null }).eq('id', id);
      setJob((prev) => (prev ? { ...prev, form_config_id: null } : prev));
    }
  };

  const handleDragStartField = (index: number) => setDragIndex(index);
  const handleDragOverField = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...fieldList];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setFieldList(updated);
    setDragIndex(index);
  };
  const handleDragEndField = () => setDragIndex(null);

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
              <>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Informações principais</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm">Título</label>
                      <Input
                        value={job.title}
                        onChange={(e) => setJob({ ...job, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm">Departamento</label>
                      <Input
                        value={job.department || ''}
                        onChange={(e) => setJob({ ...job, department: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
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
                    <div className="space-y-1">
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
                    <div className="space-y-1">
                      <label className="text-sm">Data de abertura</label>
                      <Input
                        type="date"
                        value={job.opened_at || ''}
                        onChange={(e) => setJob({ ...job, opened_at: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
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
                    <div className="sm:col-span-2 space-y-1">
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Descrição da oportunidade</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-sm">Resumo</label>
                      <textarea
                        className="w-full border rounded p-2"
                        rows={3}
                        value={job.summary || ''}
                        onChange={(e) => setJob({ ...job, summary: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Responsabilidades principais</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setListEditor('responsibilities')}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {(job.responsibilities || []).map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Requisitos obrigatórios</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setListEditor('requirements')}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {(job.requirements || []).map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Diferenciais desejáveis</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setListEditor('desirables')}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {(job.desirables || []).map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Informações estratégicas</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
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
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-sm">Tipo de contrato</label>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setListEditor('contracts')}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-1 flex flex-col gap-1">
                        {contractOptions.map((opt) => (
                          <label key={opt} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="contract_type"
                              value={opt}
                              checked={job.contract_type === opt}
                              onChange={() => setJob({ ...job, contract_type: opt })}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
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
                    <div className="space-y-1">
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
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-sm">Benefícios</label>
                      <textarea
                        className="w-full border rounded p-2"
                        rows={3}
                        value={job.benefits || ''}
                        onChange={(e) => setJob({ ...job, benefits: e.target.value })}
                      />
                    </div>
                  </CardContent>
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
              <ListSidebar
                open={listEditor !== null}
                title={
                  listEditor === 'responsibilities'
                    ? 'Responsabilidades principais'
                    : listEditor === 'requirements'
                    ? 'Requisitos obrigatórios'
                    : listEditor === 'desirables'
                    ? 'Diferenciais desejáveis'
                    : 'Tipos de contrato'
                }
                items={
                  listEditor === 'responsibilities'
                    ? job.responsibilities || []
                    : listEditor === 'requirements'
                    ? job.requirements || []
                    : listEditor === 'desirables'
                    ? job.desirables || []
                    : contractOptions
                }
                onClose={() => setListEditor(null)}
                onSave={handleListSave}
              />
              </>
            )}
          </TabsContent>
          <TabsContent value="metrics">
            {id && !Array.isArray(id) && <JobMetrics jobId={id} />}
          </TabsContent>
          <TabsContent value="ads">
            <div className="space-y-4">
              <div className="flex gap-2 items-center">
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome do formulário"
                  className="flex-1"
                />
                <div className="flex items-center gap-1">
                  <select
                    className="border p-2 rounded"
                    value={currentFormId || ''}
                    onChange={(e) => selectForm(e.target.value)}
                  >
                    <option value="">Carregar formulário...</option>
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  {currentFormId && (
                    <button
                      onClick={() => deleteFormConfig(currentFormId)}
                      className="p-1 text-gray-500"
                      title="Excluir"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={createFormConfig}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Criar novo formulário
                </button>
              </div>
              {applyFormMsg && (
                <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-800 px-4 py-2 rounded">
                  {applyFormMsg}
                </div>
              )}
              {fieldsMsg && (
                <div className="fixed top-16 right-4 bg-green-100 border border-green-400 text-green-800 px-4 py-2 rounded">
                  alterações salvas com sucesso!!
                </div>
              )}
              <div>
                <p className="font-medium mb-2">Campos do formulário público</p>
                <div className="grid grid-cols-2 gap-2">
                  {fieldList.map((f, idx) => (
                    <div
                      key={f.id}
                      className={`border rounded p-2 flex items-center gap-2 bg-white ${f.span === 2 ? 'col-span-2' : ''}`}
                      draggable
                      onDragStart={() => handleDragStartField(idx)}
                      onDragOver={(e) => handleDragOverField(idx, e)}
                      onDragEnd={handleDragEndField}
                    >
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <span className="flex-1">
                        {f.label}
                        {f.isCustom && (
                          <span className="text-sm text-gray-500"> ({f.type})</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={() =>
                          setFieldList(
                            fieldList.map((item, i) =>
                              i === idx
                                ? { ...item, span: item.span === 2 ? 1 : 2 }
                                : item
                            )
                          )
                        }
                        title={f.span === 2 ? 'Metade da largura' : 'Largura completa'}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 12h16M8 8h-4v8h4V8zm12 0h-4v8h4V8z"
                          />
                        </svg>
                      </button>
                      <Toggle
                        on={f.enabled}
                        onChange={(v) =>
                          setFieldList(
                            fieldList.map((item, i) =>
                              i === idx ? { ...item, enabled: v } : item
                            )
                          )
                        }
                      />
                      {f.isCustom && (
                        <button
                          className="text-gray-400 hover:text-red-600"
                          onClick={() =>
                            setFieldList(
                              fieldList.filter((item) => item.id !== f.id)
                            )
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setShowFieldModal(true)}
                  className="mt-2 px-3 py-1 border rounded flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Adicionar campo
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
            {id && !Array.isArray(id) && <RoteiroTab jobId={id} />}
          </TabsContent>
        </Tabs>
        {showFieldModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded p-4 w-full max-w-md max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Novo campo</h2>
                <button
                  onClick={() => setShowFieldModal(false)}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-2">
                <label className="block text-sm mb-1">Tipo</label>
                <select
                  className="w-full border p-2 rounded"
                  value={cfType}
                  onChange={(e) => setCfType(e.target.value)}
                >
                  <option value="text">Input</option>
                  <option value="textarea">Textarea</option>
                  <option value="radio">Radio</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="select">Select</option>
                  <option value="multiselect">Multi-select</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-sm mb-1">Nome</label>
                <input
                  className="w-full border p-2 rounded"
                  value={cfLabel}
                  onChange={(e) => setCfLabel(e.target.value)}
                />
              </div>
              {(cfType === 'radio' ||
                cfType === 'checkbox' ||
                cfType === 'select' ||
                cfType === 'multiselect') && (
                <div className="mb-2">
                  <label className="block text-sm mb-1">Opções</label>
                  {cfOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1">
                      <input
                        className="border p-1 rounded flex-1"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...cfOptions];
                          newOpts[idx] = e.target.value;
                          setCfOptions(newOpts);
                        }}
                      />
                      <button
                        className="text-red-600 text-sm"
                        onClick={() =>
                          setCfOptions(cfOptions.filter((_, i) => i !== idx))
                        }
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    className="text-blue-600 text-sm mt-1"
                    onClick={() => setCfOptions([...cfOptions, ''])}
                  >
                    Adicionar opção
                  </button>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowFieldModal(false)}
                  className="px-4 py-2 border rounded"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const label = cfLabel.trim();
                    if (!label) return;
                    const field: CustomField = {
                      id: crypto.randomUUID(),
                      label,
                      type: cfType,
                      enabled: true,
                      ...(cfType === 'radio' ||
                      cfType === 'checkbox' ||
                      cfType === 'select' ||
                      cfType === 'multiselect'
                        ? { options: cfOptions.filter((o) => o.trim()) }
                        : {}),
                    };
                    setFieldList([
                      ...fieldList,
                      {
                        ...field,
                        isCustom: true,
                        enabled: field.enabled ?? true,
                        span:
                          ['textarea', 'radio', 'checkbox', 'multiselect'].includes(
                            cfType
                          )
                            ? 2
                            : 1,
                      },
                    ]);
                    setCfLabel('');
                    setCfOptions(['']);
                    setCfType('text');
                    setShowFieldModal(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </>
  );
}
