import Head from 'next/head';
import Link from 'next/link';

export default function Recruitment() {
  return (
    <>
      <Head>
        <title>Recrutamento & Seleção</title>
      </Head>
      <main className="p-6">
        <h1 className="text-2xl font-bold">Recrutamento & Seleção</h1>
        <nav className="mt-6 space-y-2">
          <Link className="block text-indigo-600 hover:underline" href="/recruitment/talents">
            Banco de Talentos
          </Link>
          <Link className="block text-indigo-600 hover:underline" href="/recruitment/pipeline">
            Pipeline Global
          </Link>
          <Link className="block text-indigo-600 hover:underline" href="/recruitment/reports">
            Relatórios
          </Link>
          <Link className="block text-indigo-600 hover:underline" href="/recruitment/exports">
            Exportações
          </Link>
        </nav>
      </main>
    </>
  );
}
