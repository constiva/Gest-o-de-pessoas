import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('open');
  const [managerId, setManagerId] = useState('');
  const [editing, setEditing] = useState<Job | null>(null);

  const loadJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('id,title,description,department,status,manager_id,created_by')
      .order('created_at', { ascending: false });
    setJobs(data ?? []);
  };

  const loadManagers = async () => {
    const { data } = await supabase
      .from('companies_users')
      .select('user_id,name,role')
      .order('name');
    setManagers(data ?? []);
  };

  useEffect(() => {
    loadJobs();
    loadManagers();
  }, []);

  const counts = {
    open: jobs.filter((j) => j.status === 'open').length,
    frozen: jobs.filter((j) => j.status === 'frozen').length,
    closed: jobs.filter((j) => j.status === 'closed').length,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      title,
      description: description || null,
      department: department || null,
      status,
      manager_id: managerId || null,
    };

    if (editing) {
      await supabase.from('jobs').update(payload).eq('id', editing.id);
      setEditing(null);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase
        .from('jobs')
        .insert({ ...payload, created_by: user?.id });
    }

    setTitle('');
    setDescription('');
    setDepartment('');
    setStatus('open');
    setManagerId('');
    loadJobs();
  };

  const startEdit = (job: Job) => {
    setEditing(job);
    setTitle(job.title);
    setDescription(job.description ?? '');
    setDepartment(job.department ?? '');
    setStatus(job.status);
    setManagerId(job.manager_id ?? '');
  };

  const deleteJob = async (id: string) => {
    await supabase.from('jobs').delete().eq('id', id);
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

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2 mb-4">
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
        <div className="flex gap-2 justify-end">
          <Button type="submit">{editing ? 'Salvar' : 'Adicionar'}</Button>
          {editing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(null);
                setTitle('');
                setDescription('');
                setDepartment('');
                setStatus('open');
                setManagerId('');
              }}
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <table className="w-full text-left border-t">
        <thead>
          <tr>
            <th className="py-2">Título</th>
            <th>Departamento</th>
            <th>Gestor</th>
            <th>Criado por</th>
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
    </div>
  );
}

