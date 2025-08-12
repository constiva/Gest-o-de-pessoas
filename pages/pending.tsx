import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { Card } from '../components/ui/card';

export default function Pending() {
  const router = useRouter();
  const { companyId } = router.query;

  useEffect(() => {
    if (!companyId) return;
    const check = async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data?.status === 'active') {
        router.replace('/dashboard');
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [companyId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="p-6 text-center space-y-2">
        <h1 className="text-xl font-semibold">Aguardando confirmação de pagamento</h1>
        <p>Você será redirecionado após a confirmação.</p>
      </Card>
    </div>
  );
}
