import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import JobTalentBoard from '../../../components/recruitment/JobTalentBoard';
import { supabase } from '../../../lib/supabaseClient';

interface Job {
  id: string;
  title: string;
  form_fields: string[] | null;
}

export default function JobDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState<Job | null>(null);
  const [fields, setFields] = useState<string[]>([]);

  useEffect(() => {
    if (!id || Array.isArray(id)) return;
    supabase
      .from('jobs')
      .select('id,title,form_fields')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setJob(data);
        setFields((data?.form_fields as string[]) || ['name', 'email']);
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
            <p>Sobre a vaga em construção.</p>
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
