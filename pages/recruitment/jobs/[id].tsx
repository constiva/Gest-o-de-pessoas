import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import { supabase } from '../../../lib/supabaseClient';

interface Job {
  id: string;
  title: string;
}

export default function JobDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!id || Array.isArray(id)) return;
    supabase
      .from('jobs')
      .select('id,title')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setJob(data));
  }, [id]);

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
            <p>Talentos em construção.</p>
          </TabsContent>
          <TabsContent value="about">
            <p>Sobre a vaga em construção.</p>
          </TabsContent>
          <TabsContent value="metrics">
            <p>Métricas em construção.</p>
          </TabsContent>
          <TabsContent value="ads">
            <p>Divulgação em construção.</p>
          </TabsContent>
          <TabsContent value="settings">
            <p>Roteiro em construção.</p>
          </TabsContent>
        </Tabs>
      </Layout>
    </>
  );
}
