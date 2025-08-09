import { useState } from 'react';

export default function CheckoutAdmin() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [log, setLog] = useState('');

  const call = async (action: string, params: any = {}) => {
    const res = await fetch('/api/efibank/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params })
    });
    const data = await res.json();
    setLog(JSON.stringify(data, null, 2));
  };

  if (!authed) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <h1 className="text-xl mb-2">Admin</h1>
        <input
          type="password"
          className="border p-2 w-full mb-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
        />
        <button
          className="bg-blue-500 text-white px-4 py-2"
          onClick={() => password === '123456' && setAuthed(true)}
        >
          Entrar
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <section>
        <h2 className="font-bold">Criar plano</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as any;
            call('createPlan', {
              name: form.name.value,
              interval: Number(form.interval.value),
              repeats: form.repeats.value ? Number(form.repeats.value) : undefined
            });
          }}
          className="space-x-2"
        >
          <input name="name" placeholder="Nome" className="border p-1" />
          <input name="interval" placeholder="Intervalo" type="number" className="border p-1 w-24" />
          <input name="repeats" placeholder="Repetições" type="number" className="border p-1 w-24" />
          <button className="bg-green-500 text-white px-2 py-1">Criar</button>
        </form>
      </section>

      <section>
        <h2 className="font-bold">Listar planos</h2>
        <button className="bg-blue-500 text-white px-2 py-1" onClick={() => call('listPlans')}>Listar</button>
      </section>

      <section>
        <h2 className="font-bold">Renomear plano</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as any;
            call('updatePlan', { id: Number(form.id.value), name: form.name.value });
          }}
          className="space-x-2"
        >
          <input name="id" placeholder="Plan ID" type="number" className="border p-1 w-24" />
          <input name="name" placeholder="Novo nome" className="border p-1" />
          <button className="bg-yellow-500 text-white px-2 py-1">Atualizar</button>
        </form>
      </section>

      <section>
        <h2 className="font-bold">Cancelar plano</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as any;
            call('cancelPlan', { id: Number(form.id.value) });
          }}
          className="space-x-2"
        >
          <input name="id" placeholder="Plan ID" type="number" className="border p-1 w-24" />
          <button className="bg-red-500 text-white px-2 py-1">Cancelar</button>
        </form>
      </section>

      <section>
        <h2 className="font-bold">Criar assinatura</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as any;
            call('createSubscription', {
              planId: Number(form.planId.value),
              items: [{ name: form.item.value, value: Number(form.value.value), amount: 1 }]
            });
          }}
          className="space-x-2"
        >
          <input name="planId" placeholder="Plan ID" type="number" className="border p-1 w-24" />
          <input name="item" placeholder="Item" className="border p-1" />
          <input name="value" placeholder="Valor (centavos)" type="number" className="border p-1 w-32" />
          <button className="bg-green-500 text-white px-2 py-1">Criar</button>
        </form>
      </section>

      <section>
        <h2 className="font-bold">Pagar assinatura</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as any;
            call('paySubscription', {
              subId: Number(form.subId.value),
              payload: {
                payment: {
                  banking_billet: {
                    customer: {
                      name: form.name.value,
                      cpf: form.cpf.value,
                      email: form.email.value
                    },
                    expire_at: form.expire.value
                  }
                }
              }
            });
          }}
          className="space-x-2"
        >
          <input name="subId" placeholder="Subscription ID" type="number" className="border p-1 w-32" />
          <input name="name" placeholder="Nome" className="border p-1" />
          <input name="cpf" placeholder="CPF" className="border p-1" />
          <input name="email" placeholder="Email" className="border p-1" />
          <input name="expire" placeholder="Vencimento" className="border p-1" />
          <button className="bg-green-500 text-white px-2 py-1">Pagar</button>
        </form>
      </section>

      <pre className="whitespace-pre-wrap bg-gray-100 p-2">{log}</pre>
    </div>
  );
}
