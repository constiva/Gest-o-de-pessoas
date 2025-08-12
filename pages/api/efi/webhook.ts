// pages/api/efi/webhooks.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { PLAN_LIMITS } from '../../../lib/utils';
import fs from 'fs';
import path from 'path';

const WEBHOOK_LOG =
  process.env.NODE_ENV === 'production'
    ? '/tmp/webhook.txt'                       // Vercel só permite escrita em /tmp
    : path.join(process.cwd(), 'webhook.txt'); // Em dev, cria na raiz do projeto

function ensureLogFile() {
  try {
    if (!fs.existsSync(WEBHOOK_LOG)) fs.writeFileSync(WEBHOOK_LOG, '');
  } catch {}
}

function appendLog(entry: any) {
  try {
    ensureLogFile();
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(WEBHOOK_LOG, line);
  } catch {}
}

function readLog(): string {
  try {
    ensureLogFile();
    return fs.readFileSync(WEBHOOK_LOG, 'utf8');
  } catch {
    return '';
  }
}

function clearLog() {
  try {
    fs.writeFileSync(WEBHOOK_LOG, '');
  } catch {}
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Proteção por token (?t=...)
  const allowed = (process.env.EFI_WEBHOOK_TOKEN || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const q = req.query.t;
  const token = Array.isArray(q) ? q[0] : q;

  if (!token || !allowed.includes(token)) {
    appendLog({
      ts: new Date().toISOString(),
      type: 'reject',
      reason: 'invalid-token',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
    return res.status(401).json({ ok: false, error: 'invalid token' });
  }

  // Utilitários de debug via GET
  if (req.method === 'GET') {
    if ('clear' in req.query) {
      clearLog();
      return res.status(200).json({ ok: true, cleared: true, file: WEBHOOK_LOG });
    }
    if ('dump' in req.query) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(readLog() || '(vazio)');
    }
    return res.status(200).json({ ok: true, file: WEBHOOK_LOG, hint: 'use ?dump=1 ou ?clear=1' });
  }

  if (req.method !== 'POST') return res.status(405).end();

  // Corpo bruto recebido
  const body: any = req.body || {};
  const subscriptionId =
    body?.subscription_id ?? body?.subscription?.id ?? null;
  const status =
    body?.status ?? body?.charge?.status ?? body?.event ?? null;

  // Guarda entrada recebida
  appendLog({
    ts: new Date().toISOString(),
    type: 'incoming',
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type']
    },
    parsed: { subscriptionId, status },
    bodyKeys: Object.keys(body || {})
  });

  // Seu fluxo atual de ativação
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

        appendLog({
          ts: new Date().toISOString(),
          type: 'db-update',
          action: 'activate-subscription',
          company_id: sub.company_id,
          plan: sub.plan,
          limit,
          efibank_id: subscriptionId
        });
      } else {
        appendLog({
          ts: new Date().toISOString(),
          type: 'db-miss',
          reason: 'subscription-not-found',
          efibank_id: subscriptionId
        });
      }
    } catch (e: any) {
      appendLog({
        ts: new Date().toISOString(),
        type: 'db-error',
        message: e?.message || String(e)
      });
    }
  }

  // Resposta final
  const response = { ok: true };
  appendLog({ ts: new Date().toISOString(), type: 'response', response });

  res.status(200).json(response);
}
