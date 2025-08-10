import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabaseClient';
import { PLAN_LIMITS } from '../lib/utils';

interface Profile {
  name: string;
  email: string;
  companyId: string;
}

export default function Upgrade() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data } = await supabase
        .from('users')
        .select('name,email,company_id')
        .eq('id', user.id)
        .single();
      setProfile({
        name: data?.name ?? '',
        email: data?.email ?? '',
        companyId: data?.company_id ?? ''
      });
    };
    load();
  }, [router]);

  if (!profile) return <p>Carregando...</p>;

  const plans = [
    { id: 'pro', label: 'Pro', limit: PLAN_LIMITS.pro },
    { id: 'enterprise', label: 'Enterprise', limit: PLAN_LIMITS.enterprise },
  ];

  const gotoCheckout = (planId: string) => {
    router.push(
      `/checkout?plan=${planId}&companyId=${profile.companyId}&name=${encodeURIComponent(
        profile.name
      )}&email=${encodeURIComponent(profile.email)}`
    );
  };

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-6">Upgrade de plano</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {plans.map((p) => (
          <div key={p.id} className="border rounded p-4 flex flex-col">
            <h2 className="font-semibold text-lg mb-2">{p.label}</h2>
            <p className="mb-4">Até {p.limit} funcionários</p>
            <Button onClick={() => gotoCheckout(p.id)}>Selecionar</Button>
          </div>
        ))}
      </div>
    </Layout>
  );
}
