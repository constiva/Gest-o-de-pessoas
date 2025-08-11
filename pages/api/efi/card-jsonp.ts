// pages/api/efi/card-jsonp.ts
import type { NextApiRequest, NextApiResponse } from 'next';

// Usa o mesmo env do front pra decidir sandbox vs produção
const EFI_ENV = (process.env.NEXT_PUBLIC_EFI_ENV || 'sandbox') as 'sandbox' | 'production';
const BASE = EFI_ENV === 'production'
  ? 'https://cobrancas.api.efipay.com.br'
  : 'https://cobrancas-h.api.efipay.com.br';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed'); return;
  }

  const { accountId } = req.query;
  if (!accountId || Array.isArray(accountId)) {
    res.status(400).send('Missing accountId'); return;
  }

  try {
    // Remonta a query string original (tudo exceto accountId)
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'accountId') continue;
      if (Array.isArray(v)) v.forEach((x) => search.append(k, String(x)));
      else search.append(k, String(v));
    }

    const url = `${BASE}/v1/card/${encodeURIComponent(String(accountId))}/jsonp?${search.toString()}`;

    // Faz o GET server-side e devolve o JS do JSONP "como texto"
    const upstream = await fetch(url, {
      method: 'GET',
      // cabeçalhos simples; sem credenciais/mTLS aqui
      headers: { 'Accept': 'application/javascript,text/javascript,*/*' },
    });

    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (!upstream.ok) {
      // repassa status da origem pra facilitar debug no console
      res.status(upstream.status).send(body);
      return;
    }

    res.status(200).send(body);
  } catch (err: any) {
    console.error('[card-jsonp][proxy] fail:', err?.message || err);
    res.status(502).send('Bad Gateway (proxy JSONP)');
  }
}
