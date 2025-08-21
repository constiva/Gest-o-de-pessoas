import Head from 'next/head';
import Layout from '../../components/Layout';
import JobTab from '../../components/recruitment/JobTab';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../components/ui/tabs';

export default function Recruitment() {
  return (
    <>
      <Head>
        <title>Recrutamento & Seleção</title>
      </Head>
      <Layout>
        <h1 className="text-2xl font-bold mb-4">Recrutamento & Seleção</h1>
        <Tabs defaultValue="jobs">
          <TabsList className="mb-4">
            <TabsTrigger value="jobs">Vagas</TabsTrigger>
            <TabsTrigger value="talents">Banco de Talentos</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline Global</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
            <TabsTrigger value="exports">Exportações</TabsTrigger>
          </TabsList>
          <TabsContent value="jobs">
            <JobTab />
          </TabsContent>
          <TabsContent value="talents">
            <p>Banco de Talentos em construção.</p>
          </TabsContent>
          <TabsContent value="pipeline">
            <p>Pipeline Global em construção.</p>
          </TabsContent>
          <TabsContent value="reports">
            <p>Relatórios em construção.</p>
          </TabsContent>
          <TabsContent value="exports">
            <p>Exportações em construção.</p>
          </TabsContent>
        </Tabs>
      </Layout>
    </>
  );
}

