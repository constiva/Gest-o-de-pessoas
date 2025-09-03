import Head from 'next/head';
import Layout from '../../components/Layout';
import JobTab from '../../components/recruitment/JobTab';
import TalentTab from '../../components/recruitment/TalentTab';
import RecruitmentMetrics from '../../components/recruitment/RecruitmentMetrics';
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
            <TabsTrigger value="metrics">Métricas</TabsTrigger>
          </TabsList>
          <TabsContent value="jobs">
            <JobTab />
          </TabsContent>
          <TabsContent value="talents">
            <TalentTab />
          </TabsContent>
          <TabsContent value="metrics">
            <RecruitmentMetrics />
          </TabsContent>
        </Tabs>
      </Layout>
    </>
  );
}

