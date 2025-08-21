import Head from 'next/head';

export default function Pipeline() {
  return (
    <>
      <Head>
        <title>Pipeline Global</title>
      </Head>
      <main className="p-6">
        <h1 className="text-2xl font-bold">Pipeline Global</h1>
        <p className="mt-4 text-gray-600">
          Acompanhe todas as candidaturas por etapa em um único quadro.
        </p>
      </main>
    </>
  );
}
