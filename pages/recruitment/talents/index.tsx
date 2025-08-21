import Head from 'next/head';

export default function Talents() {
  return (
    <>
      <Head>
        <title>Banco de Talentos</title>
      </Head>
      <main className="p-6">
        <h1 className="text-2xl font-bold">Banco de Talentos</h1>
        <p className="mt-4 text-gray-600">
          Gerencie candidatos, suas habilidades e histórico de processos.
        </p>
      </main>
    </>
  );
}
