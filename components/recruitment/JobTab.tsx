import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X } from 'lucide-react';

interface Manager {
  user_id: string;
  name: string | null;
  role?: string | null;
}

interface Job {
  id: string;
  title: string;
  description: string | null;
  department: string | null;
  status: string;
  manager_id: string | null;
  created_by: string | null;
  created_at: string;
  sla: string | null;
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    open: 'Aberta',
    frozen: 'Congelada',
    closed: 'Fechada',
  };
  return map[s] || s;
}

export default function JobTab() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('open');
  const [managerId, setManagerId] = useState('');
  const [editing, setEditing] = useState<Job | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'cards'>('list');
  const [sla, setSla] = useState('');
  const [slaDays, setSlaDays] = useState('');

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setDepartment('');
    setStatus('open');
    setManagerId('');
    setSla('');
    setSlaDays('');
  };

  const loadJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('id,title,description,department,status,manager_id,created_by,created_at,sla')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }
    setJobs(data ?? []);
  };

  const loadManagers = async () => {
    const { data, error } = await supabase
      .from('companies_users')
      .select('user_id,name,role')
      .order('name');
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }
    setManagers(data ?? []);
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      await loadJobs();
      await loadManagers();
    };
    init();
  }, []);

  const counts = {
    open: jobs.filter((j) => j.status === 'open').length,
    frozen: jobs.filter((j) => j.status === 'frozen').length,
    closed: jobs.filter((j) => j.status === 'closed').length,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert('Sessão expirada. Faça login novamente.');
      return;
    }

    const payload = {
      title,
      description: description || null,
      department: department || null,
      status,
      manager_id: managerId || null,
      sla: sla || null,
    };

    if (editing) {
      const { error } = await supabase
        .from('jobs')
        .update(payload)
        .eq('id', editing.id);
      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }
      setEditing(null);
    } else {
      const { error } = await supabase
        .from('jobs')
        .insert({ ...payload, created_by: session.user.id });
      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }
    }

    resetForm();
    setOpen(false);
    loadJobs();
  };

  const startEdit = (job: Job) => {
    setEditing(job);
    setTitle(job.title);
    setDescription(job.description ?? '');
    setDepartment(job.department ?? '');
    setStatus(job.status);
    setManagerId(job.manager_id ?? '');
    setSla(job.sla ? job.sla : '');
    setSlaDays('');
    setOpen(true);
  };

  const deleteJob = async (id: string) => {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }
    loadJobs();
  };

  const updateStatus = async (job: Job, newStatus: string) => {
    const { error } = await supabase
      .from('jobs')
      .update({ status: newStatus })
      .eq('id', job.id);
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }
    loadJobs();
  };

  const duplicateJob = async (job: Job) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const copy = {
      title: job.title,
      description: job.description,
      department: job.department,
      status: 'open',
      manager_id: job.manager_id,
      created_by: session.user.id,
      sla: job.sla,
    };
    const { error } = await supabase.from('jobs').insert(copy);
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }
    loadJobs();
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-sm text-gray-500">Abertas</p>
          <p className="text-2xl font-bold">{counts.open}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Congeladas</p>
          <p className="text-2xl font-bold">{counts.frozen}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Fechadas</p>
          <p className="text-2xl font-bold">{counts.closed}</p>
        </Card>
      </div>

      <div className="flex justify-end gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setView(view === 'list' ? 'cards' : 'list')}
        >
          {view === 'list' ? 'Cards' : 'Lista'}
        </Button>
        <Button
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          Criar vaga
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              resetForm();
              setOpen(false);
            }}
          />
          <div className="relative bg-white rounded-md w-full max-w-lg p-4 shadow-xl dark:bg-gray-900">
            <button
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2 mt-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título da vaga"
                className="col-span-2"
              />
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Departamento"
              />
              <select
                className="border rounded-md px-2"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="open">Aberta</option>
                <option value="frozen">Congelada</option>
                <option value="closed">Fechada</option>
              </select>
              <Input
                type="date"
                value={sla}
                onChange={(e) => setSla(e.target.value)}
                placeholder="SLA"
              />
              <Input
                type="number"
                value={slaDays}
                onChange={(e) => {
                  const v = e.target.value;
                  setSlaDays(v);
                  if (v) {
                    const d = new Date();
                    d.setDate(d.getDate() + parseInt(v));
                    setSla(d.toISOString().split('T')[0]);
                  }
                }}
                placeholder="Dias para fechar"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição"
                className="col-span-2 border rounded-md p-2"
              />
              <select
                className="border rounded-md px-2"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
              >
                <option value="">Sem gestor</option>
                {managers
                  .filter((m) =>
                    ['admin', 'manager', 'recruiter'].includes(m.role ?? '')
                  )
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name ?? m.user_id}
                    </option>
                  ))}
              </select>
              <div className="flex gap-2 justify-end col-span-2">
                <Button type="submit">{editing ? 'Salvar' : 'Adicionar'}</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setOpen(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === 'list' ? (
        <table className="w-full text-left border-t">
          <thead>
            <tr>
              <th className="py-2">Título</th>
              <th>Departamento</th>
              <th>Gestor</th>
              <th>Criado por</th>
              <th>SLA</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t">
                <td className="py-2">{job.title}</td>
                <td>{job.department}</td>
                <td>
                  {managers.find((m) => m.user_id === job.manager_id)?.name || ''}
                </td>
                <td>
                  {managers.find((m) => m.user_id === job.created_by)?.name || ''}
                </td>
                <td>{job.sla || '-'}</td>
                <td>{statusLabel(job.status)}</td>
                <td className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(job)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteJob(job.id)}
                  >
                    Excluir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => {
            const manager =
              managers.find((m) => m.user_id === job.manager_id)?.name || '';
            const daysOpen = Math.floor(
              (Date.now() - new Date(job.created_at).getTime()) / 86400000
            );
            return (
              <Card key={job.id} className="p-4 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold">{job.title}</h3>
                  <p className="text-sm text-gray-600">
                    {job.department || ''} {job.department && manager ? '•' : ''}{' '}
                    {manager}
                  </p>
                  <p className="text-xs text-gray-500">{daysOpen} dias aberta</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/recruitment/pipeline?job=${job.id}`)}
                  >
                    Ver pipeline
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/recruitment/exports?job=${job.id}`)}
                  >
                    Exportar candidatos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/recruitment/jobs/${job.id}`)}
                  >
                    Criar divulgação
                  </Button>
                  <Button size="sm" onClick={() => updateStatus(job, 'closed')}>
                    Fechar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(job, 'frozen')}
                  >
                    Congelar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => duplicateJob(job)}
                  >
                    Duplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteJob(job.id)}
                  >
                    Excluir
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

