import { Button } from '../components/ui/button';
import { Users, BarChart3, Briefcase, TrendingUp, CheckCircle, UserPlus, LogIn } from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Gestão de Funcionários',
    description: 'Centralize dados e processos de admissão e desligamento em um só lugar.',
  },
  {
    icon: BarChart3,
    title: 'Métricas de Pessoas',
    description: 'Acompanhe headcount, turnover e produtividade do time em tempo real.',
  },
  {
    icon: Briefcase,
    title: 'Controle de Times',
    description: 'Organize cargos, departamentos e estruturas organizacionais facilmente.',
  },
  {
    icon: TrendingUp,
    title: 'Relatórios',
    description: 'Obtenha insights para decisões estratégicas com relatórios claros e objetivos.',
  },
];

const plans = [
  {
    name: 'Free',
    price: 'R$0',
    features: ['Até 5 funcionários', 'Dashboard básico'],
    cta: 'Começar',
  },
  {
    name: 'Starter',
    price: 'R$49/mês',
    features: ['Até 50 funcionários', 'Relatórios avançados', 'Suporte por e-mail'],
    cta: 'Assinar',
    highlighted: true,
  },
  {
    name: 'Growth',
    price: 'R$199/mês',
    features: ['Funcionários ilimitados', 'Integrações', 'Suporte premium'],
    cta: 'Fale Conosco',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gradient-to-br from-brand to-brand/70 text-white">
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">
          <h1 className="text-5xl font-extrabold mb-4">Gestão de Pessoas Descomplicada</h1>
          <p className="text-lg mb-8">Tudo que você precisa para cuidar do seu time em um SaaS moderno e intuitivo.</p>
          <div className="flex justify-center gap-4">
            <Button asChild>
              <a href="/register" className="flex items-center gap-2"><UserPlus className="h-4 w-4"/>Comece Agora</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/login" className="flex items-center gap-2"><LogIn className="h-4 w-4"/>Entrar</a>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="py-20 max-w-5xl mx-auto px-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex flex-col items-start">
              <Icon className="h-8 w-8 text-brand mb-4" />
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
            </div>
          ))}
        </section>

        <section className="bg-muted py-20">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-12">Depoimentos</h2>
            <div className="max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm">
              <img src="https://i.pravatar.cc/100" alt="Depoimento" className="h-16 w-16 rounded-full mx-auto mb-4" />
              <p className="italic text-gray-700 dark:text-gray-300">“Constiva mudou nossa forma de gerir pessoas. Simples, completo e moderno.”</p>
              <p className="mt-4 font-semibold">Maria Souza</p>
              <p className="text-sm text-gray-500">Gerente de RH</p>
            </div>
          </div>
        </section>

        <section className="py-20 max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Planos</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map(({ name, price, features, cta, highlighted }) => (
              <div key={name} className={`p-8 rounded-xl shadow-sm bg-white dark:bg-gray-800 flex flex-col ${highlighted ? 'ring-2 ring-brand' : ''}`}>
                <h3 className="text-xl font-bold mb-2 text-center">{name}</h3>
                <p className="text-3xl font-extrabold text-center mb-6">{price}</p>
                <ul className="mb-6 space-y-2 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-brand" />{f}</li>
                  ))}
                </ul>
                <Button asChild className="w-full mt-auto" variant={highlighted ? 'default' : 'outline'}>
                  <a href="/register">{cta}</a>
                </Button>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="text-center py-6 text-sm text-gray-500">© {new Date().getFullYear()} Constiva. Todos os direitos reservados.</footer>
    </div>
  );
}
