import Head from 'next/head';
import Layout from '../../../components/Layout';
import TalentTab from '../../../components/recruitment/TalentTab';

export default function Talents() {
  return (
    <>
      <Head>
        <title>Banco de Talentos</title>
      </Head>
      <Layout>
        <TalentTab />
      </Layout>
    </>
  );
}
