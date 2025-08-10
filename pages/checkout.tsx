import { useEffect, useState } from 'react';
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
    brand: '',
    number: '',
    cvv: '',
    expiration_month: '',
    expiration_year: '',
    street: '',
    num: '',
    neighborhood: '',
    zipcode: '',
    city: '',
    state: ''
  });
  const [checkoutObj, setCheckoutObj] = useState<any>(null);

  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_EFIBANK_ACCOUNT_ID;
    if (!id) return;
    (window as any).$gn = {
      validForm: true,
      processed: false,
      done: {},
      ready: function (fn: any) {
        (window as any).$gn.done = fn;
      }
    };
    const s = document.createElement('script');
    const v = Math.floor(Math.random() * 1000000);
    s.src = `https://sandbox.gerencianet.com.br/v1/cdn/${id}/${v}`;
    s.id = id;
    document.head.appendChild(s);
    (window as any).$gn.ready((checkout: any) => setCheckoutObj(checkout));
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    const token: string = await new Promise((resolve, reject) => {
      if (!checkoutObj) return reject(new Error('checkout not loaded'));
      checkoutObj.getPaymentToken({
        brand: form.brand,
        number: form.number,
        cvv: form.cvv,
        expiration_month: form.expiration_month,
        expiration_year: form.expiration_year
      }, (err: any, data: any) => {
        if (err) reject(err); else resolve(data.data.payment_token);
      });
    });

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
        payment_token: token,
        billing_address: {
          street: form.street,
          number: form.num,
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
          <Input name="brand" placeholder="Bandeira" onChange={handleChange} />
          <Input name="number" placeholder="Número do cartão" onChange={handleChange} />
          <Input name="cvv" placeholder="CVV" onChange={handleChange} />
          <Input name="expiration_month" placeholder="Mês de vencimento" onChange={handleChange} />
          <Input name="expiration_year" placeholder="Ano de vencimento" onChange={handleChange} />
          <Input name="street" placeholder="Rua" onChange={handleChange} />
          <Input name="num" placeholder="Número" onChange={handleChange} />
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
