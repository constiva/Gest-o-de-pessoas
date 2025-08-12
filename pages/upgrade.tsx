import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabaseClient';

type Plan = {
  id: string;                // uuid
  name: string;
  slug: 'free'|'starter'|'professional'|'business'|'enterprise'|string;
  description: string | null;
  price_cents: number;
  interval_months: number;
  trial_days: number;
  max_employees: number;
  features_json: string[] | null; // Supabase tipará como any; tratamos como string[]
  active: boolean;
};

type Profile = {
  name: string;
  email: string;
  companyId: string;
  currentPlan?: string | null; // opcional, se quiser exibir "plano atual"
};

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Upgrade() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      // profile
      const { data: u } = await supabase
        .from('users')
        .select('name,email,company_id, companies:company_id ( plan )')
        .eq('id', user.id)
        .single();

      setProfile({
        name: u?.name ?? '',
        email: u?.email ?? '',
        companyId: u?.company_id ?? '',
        currentPlan: u?.companies?.[0]?.plan ?? null
      });

      // plans (ativos)
      const { data: p } = await supabase
        .from('plans')
        .select('id,name,slug,description,price_cents,interval_months,trial_days,max_employees,features_json,active')
        .eq('active', true);

      // Garante a ordem desejada
      const order = ['free','starter','professional','business','enterprise'];
      const sorted = (p ?? []).sort((a, b) => {
        const ia = order.indexOf(a.slug);
        const ib = order.indexOf(b.slug);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return (a.price_cents || 0) - (b.price_cents || 0);
      });

      setPlans(sorted as Plan[]);
      setLoading(false);
    })();
  }, [router]);

  const cards = useMemo(() => {
    return plans.map((pl) => {
      const isEnterprise = pl.slug === 'enterprise';
      const isFree = pl.slug === 'free';
      const monthly = formatBRL(pl.price_cents);
      const perEmployee = !isEnterprise && pl.max_employees > 0
        ? (pl.price_cents / 100 / pl.max_employees).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          })
        : null;

      return {
        ...pl,
        monthly,
        perEmployee,
        isEnterprise,
        isFree
      };
    });
  }, [plans]);

  const gotoCheckout = (planId: string) => {
    if (!profile) return;
    // Segurança: mandamos só o essencial. O /checkout re-busca no DB pelo planId e valida company do usuário logado.
    router.push(`/checkout?planId=${planId}&companyId=${profile.companyId}`);
  };

  if (loading || !profile) {
    return (
      <Layout>
        <div className="py-16 text-center text-muted-foreground">Carregando...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-2">Escolha seu plano</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Mude de plano a qualquer momento. Cobrança mensal, cancelamento simples.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((pl) => {
          const badge =
            pl.slug === profile.currentPlan
              ? 'Plano atual'
              : pl.isFree
              ? 'Freemium'
              : undefined;

          return (
            <div
              key={pl.id}
              className={`rounded-2xl border p-6 flex flex-col gap-4 shadow-sm ${
                pl.slug === 'business' ? 'ring-2 ring-orange-300' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{pl.name}</h2>
                {badge && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{badge}</span>
                )}
              </div>

              <div>
                <div className="text-3xl font-bold">{pl.monthly}
                  <span className="text-base font-medium text-muted-foreground">/mês</span>
                </div>
                {pl.perEmployee && (
                  <div className="text-sm text-muted-foreground">
                    {pl.perEmployee} por funcionário/mês
                  </div>
                )}
              </div>

              <ul className="text-sm space-y-2">
                <li className="font-medium">
                  {pl.isEnterprise ? 'Funcionários ilimitados' : `Até ${pl.max_employees} funcionários`}
                </li>
                {Array.isArray(pl.features_json) &&
                  pl.features_json.map((f, i) => (
                    <li key={i} className="text-muted-foreground">• {f}</li>
                  ))}
                {pl.isEnterprise && (
                  <li className="text-muted-foreground">• Customizações e implementação</li>
                )}
              </ul>

              <div className="mt-auto pt-2">
                {pl.isFree ? (
                  <Button
                    variant="outline"
                    onClick={() => gotoCheckout(pl.id)}
                    disabled={profile?.currentPlan === pl.slug} // desabilita só se já estiver nesse plano
                    className="w-full"
                  >
                    {profile?.currentPlan === pl.slug ? 'Seu plano atual' : 'Assinar'}
                  </Button>
                ) : (
                  <Button onClick={() => gotoCheckout(pl.id)} className="w-full">
                    Selecionar {pl.name}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-xs text-muted-foreground">
        Valores em BRL. Os limites de funcionários são aplicados após confirmação de pagamento.
      </div>
    </Layout>
  );
}