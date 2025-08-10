import { useState } from 'react';
import { useRouter } from 'next/router';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { supabase } from '../lib/supabaseClient';

export default function Checkout() {
  const router = useRouter();
  const { plan, name, email, companyId } = router.query as Record<string, string>;
  const [form, setForm] = useState({
    cpf: '',
    phone: '',
    token: '',
    street: '',
    number: '',
    neighborhood: '',
    zipcode: '',
    city: '',
    state: ''
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const res = await fetch('/api/efibank/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plano: { descricao: plan, interval: 1 },
        customer: {
          name,
          email,
          cpf: form.cpf,
          phone_number: form.phone
        },
        item: { name: 'Assinatura', amount: 1, value: 1000 },
        payment_token: form.token,
        billing_address: {
          street: form.street,
          number: form.number,
          neighborhood: form.neighborhood,
          zipcode: form.zipcode,
          city: form.city,
          state: form.state
        }
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
          <Input name="cpf" placeholder="CPF" onChange={handleChange} />
          <Input name="phone" placeholder="Telefone" onChange={handleChange} />
          <Input name="token" placeholder="Token do cartão" onChange={handleChange} />
          <Input name="street" placeholder="Rua" onChange={handleChange} />
          <Input name="number" placeholder="Número" onChange={handleChange} />
          <Input name="neighborhood" placeholder="Bairro" onChange={handleChange} />
          <Input name="zipcode" placeholder="CEP" onChange={handleChange} />
          <Input name="city" placeholder="Cidade" onChange={handleChange} />
          <Input name="state" placeholder="Estado" onChange={handleChange} />
          <Button type="submit" className="w-full">Pagar</Button>
        </form>
      </Card>
    </div>
  );
}
