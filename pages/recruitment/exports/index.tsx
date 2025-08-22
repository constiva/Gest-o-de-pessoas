import Head from 'next/head';

export default function Exports() {
  return (
    <>
      <Head>
        <title>Exportações</title>
      </Head>
      <main className="p-6">
        <h1 className="text-2xl font-bold">Exportações</h1>
        <p className="mt-4 text-gray-600">
          Gere planilhas e PDFs com dados filtrados de vagas e talentos.
        </p>
      </main>
    </>
  );
}
