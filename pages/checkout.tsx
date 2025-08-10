import { useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { supabase } from '../lib/supabaseClient';

export default function Checkout() {
  const router = useRouter();
  const { plan, name, email, companyId } = router.query as Record<string, string>;
  const [card, setCard] = useState({
    number: '',
    holder: '',
    expMonth: '',
    expYear: '',
    cvv: ''
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCard({ ...card, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const res = await fetch('/api/efibank/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        customer: { name, email },
        card
      })
    });
    const sub = await res.json();
    await supabase.from('subscriptions').insert({
      company_id: companyId,
      plan,
      efibank_id: sub.subscription_id,
    });
    router.push(`/pending?companyId=${companyId}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-center">Checkout do plano {plan}</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input name="number" placeholder="Número do cartão" onChange={handleChange} />
          <Input name="holder" placeholder="Nome do titular" onChange={handleChange} />
          <div className="flex gap-2">
            <Input name="expMonth" placeholder="Mês" onChange={handleChange} />
            <Input name="expYear" placeholder="Ano" onChange={handleChange} />
            <Input name="cvv" placeholder="CVV" onChange={handleChange} />
          </div>
          <Button type="submit" className="w-full">Pagar</Button>
        </form>
      </Card>
    </div>
  );
}
