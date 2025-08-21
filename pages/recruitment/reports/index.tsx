import Head from 'next/head';

export default function Reports() {
  return (
    <>
      <Head>
        <title>Relatórios</title>
      </Head>
      <main className="p-6">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="mt-4 text-gray-600">
          KPIs e análises sobre eficiência e origens das candidaturas.
        </p>
      </main>
    </>
  );
}
