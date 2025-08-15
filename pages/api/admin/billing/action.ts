import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function requireAdmin(req: NextApiRequest) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: me } = await supabaseAdmin.from('users').select('id, is_admin').eq('id', data.user.id).maybeSingle();
  if (!me?.is_admin) return null;
  return data.user;
}

function resolveCertPath(input?: string): string | null {
  if (!input) return null;
  let p = input.trim().replace(/\\/g, '/');
  if (!path.isAbsolute(p)) p = path.join(process.cwd(), p);
  return p;
}
async function getEfiSdk(): Promise<{ EfiPay: any }> {
  try { const mod = await import('sdk-node-apis-efi'); return { EfiPay: (mod as any).default ?? (mod as any) }; }
  catch { const mod = await import('sdk-typescript-apis-efi'); return { EfiPay: (mod as any).default ?? (mod as any) }; }
}
async function makeEfiApi() {
  const sandbox = String(process.env.EFI_SANDBOX).toLowerCase() === 'true';
  const clean = (v?: string) => (v ?? '').replace(/[\r\n]/g, '').trim();
  const client_id = clean(process.env.EFI_CLIENT_ID);
  const client_secret = clean(process.env.EFI_CLIENT_SECRET);
  let certificate = resolveCertPath(process.env.EFI_CERT_PATH || '');
  if (!certificate && process.env.EFI_CERT_PEM_BASE64) {
    const tmp = '/tmp/efi-cert.pem';
    fs.writeFileSync(tmp, Buffer.from(process.env.EFI_CERT_PEM_BASE64, 'base64'));
    certificate = tmp;
  }
  if (!client_id || !client_secret || !certificate) throw new Error('Credenciais/certificado Efí ausentes.');
  const { EfiPay } = await getEfiSdk();
  const opts: any = { sandbox, client_id, client_secret, clientId: client_id, clientSecret: client_secret, certificate };
  if (process.env.EFI_CERT_PASSWORD) opts.certificate_key = process.env.EFI_CERT_PASSWORD;
  return new (EfiPay as any)(opts);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });
  const { action } = req.body || {};

  try {
    if (action === 'refresh') {
      const { efi_subscription_id } = req.body as { efi_subscription_id: number };
      const api = await makeEfiApi();
      const det = await (api as any).detailSubscription({ id: Number(efi_subscription_id) });
      return res.status(200).json({ ok: true, subscription: det?.data ?? det });
    }

    if (action === 'cancel') {
      const { subscription_id, efi_subscription_id } = req.body as { subscription_id: string; efi_subscription_id: number };
      const api = await makeEfiApi();
      try { await (api as any).cancelSubscription({ id: Number(efi_subscription_id) }); } catch {}
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', subscription_id);
      return res.status(200).json({ ok: true });
    }

    if (action === 'mark_actual') {
      const { subscription_id } = req.body as { subscription_id: string };
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('id, company_id, plan_id')
        .eq('id', subscription_id)
        .maybeSingle();
      if (!sub) return res.status(404).json({ ok: false, error: 'subscription not found' });

      // desliga outras e liga esta
      await supabaseAdmin
        .from('subscriptions')
        .update({ actual_plan: 'no', updated_at: new Date().toISOString() })
        .eq('company_id', sub.company_id)
        .neq('id', subscription_id);

      await supabaseAdmin
        .from('subscriptions')
        .update({ actual_plan: 'yes', updated_at: new Date().toISOString() })
        .eq('id', subscription_id);

      if (sub.plan_id) {
        const { data: plan } = await supabaseAdmin
          .from('plans')
          .select('slug, max_employees')
          .eq('id', sub.plan_id)
          .maybeSingle();
        if (plan) {
          await supabaseAdmin
            .from('companies')
            .update({ plan: plan.slug, maxemployees: plan.max_employees ?? null })
            .eq('id', sub.company_id);
        }
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'action failed' });
  }
}