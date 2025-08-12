// pages/api/efi/webhooks.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { PLAN_LIMITS } from '../../../lib/utils';
import fs from 'fs';
import path from 'path';

const DEBUG_PATH =
  process.env.NODE_ENV === 'production'
    ? '/tmp/efi-webhooks.log' // Vercel: só /tmp é gravável
    : path.join(process.cwd(), 'debugCheckout.txt');

function safeStringify(data: unknown) {
  try { return JSON.stringify(data); } catch { return String(data); }
}

function logDebug(msg: string, data?: unknown) {
  const line = `[${new Date().toISOString()}] ${msg}` +
    (data ? ` ${safeStringify(data)}` : '') + '\n';
  try { fs.appendFileSync(DEBUG_PATH, line); } catch {}
  console.log('[EFI][WEBHOOK]', msg, data ?? '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // 1) Autorização por token na query (?t=...)
  const allowed = (process.env.EFI_WEBHOOK_TOKEN || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const q = req.query.t;
  const token = Array.isArray(q) ? q[0] : q;

  if (!token || !allowed.includes(token)) {
    logDebug('invalid token', { ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
    return res.status(401).json({ ok: false, error: 'invalid token' });
  }

  // 2) Parse básico do corpo (a Efí pode mandar vários formatos)
  const body: any = req.body || {};
  const subscriptionId =
    body?.subscription_id ?? body?.subscription?.id ?? null;
  const status =
    body?.status ?? body?.charge?.status ?? body?.event ?? null;

  logDebug('Webhook received', { subscriptionId, status, rawKeys: Object.keys(body || {}) });

  // 3) Seu fluxo atual: quando "paid" -> ativa assinatura + ajusta limites
  if (subscriptionId && String(status).toLowerCase() === 'paid') {
    try {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('efibank_id', subscriptionId)
        .single();

      if (sub) {
        await supabase
          .from('subscriptions')
          .update({ status: 'active' })
          .eq('id', sub.id);

        const limit = PLAN_LIMITS[sub.plan as keyof typeof PLAN_LIMITS];
        if (limit) {
          await supabase
            .from('companies')
            .update({ maxemployees: limit })
            .eq('id', sub.company_id);
        }
        logDebug('Subscription activated', { company: sub.company_id, limit, efibank_id: subscriptionId });
      } else {
        logDebug('Subscription not found (efibank_id)', { subscriptionId });
      }
    } catch (e: any) {
      logDebug('DB error', { message: e?.message || e });
    }
  }

  // 4) Sempre responde 200 rapidamente
  res.status(200).json({ ok: true });
}
