import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface Job {
  id: string;
  title: string;
  status: string;
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
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('open');
  const [editing, setEditing] = useState<Job | null>(null);

  const loadJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('id,title,status')
      .order('created_at', { ascending: false });
    setJobs(data ?? []);
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const counts = {
    open: jobs.filter((j) => j.status === 'open').length,
    frozen: jobs.filter((j) => j.status === 'frozen').length,
    closed: jobs.filter((j) => j.status === 'closed').length,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await supabase
        .from('jobs')
        .update({ title, status })
        .eq('id', editing.id);
      setEditing(null);
    } else {
      await supabase.from('jobs').insert({ title, status });
    }
    setTitle('');
    setStatus('open');
    loadJobs();
  };

  const startEdit = (job: Job) => {
    setEditing(job);
    setTitle(job.title);
    setStatus(job.status);
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

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da vaga"
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
        <Button type="submit">{editing ? 'Salvar' : 'Adicionar'}</Button>
        {editing && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setTitle('');
              setStatus('open');
            }}
          >
            Cancelar
          </Button>
        )}
      </form>

      <table className="w-full text-left border-t">
        <thead>
          <tr>
            <th className="py-2">Título</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-t">
              <td className="py-2">{job.title}</td>
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

