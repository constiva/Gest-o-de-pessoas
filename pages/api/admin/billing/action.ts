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

// ---------- Efí helpers ----------
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

// ---------- utils ----------
const nowIso = () => new Date().toISOString();
function slugify(input: string, maxLen = 64) {
  return input.normalize('NFKD')
    .replace(/[^\w\- ]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, maxLen);
}
function getBaseUrl(req: NextApiRequest) {
  const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  return `${proto}://${host}`;
}
async function ensureUniqueSlug(baseSlug: string) {
  let slug = baseSlug;
  let i = 1;
  // tenta até achar um que não conflite
  while (true) {
    const { data } = await supabaseAdmin.from('plans').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    i += 1;
    slug = `${baseSlug}-${i}`;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });
  const { action } = req.body || {};

  try {
    // ================== EXISTENTES ==================
    if (action === 'refresh') {
      const { efi_subscription_id } = req.body as { efi_subscription_id: number };
      const api = await makeEfiApi();
      const det = await (api as any).detailSubscription({ id: Number(efi_subscription_id) });
      return res.status(200).json({ ok: true, subscription: det?.data ?? det });
    }

    if (action === 'cancel') {
      const { subscription_id, efi_subscription_id } = req.body as { subscription_id: string; efi_subscription_id: number };
      const api = await makeEfiApi();
      try { await (api as any).cancelSubscription({ id: Number(efi_subscription_id) }); } catch { /* ok se já cancelada */ }

      // pega info da sub pra saber se era a atual
      const { data: subRow } = await supabaseAdmin
        .from('subscriptions')
        .select('id, company_id, actual_plan')
        .eq('id', subscription_id)
        .maybeSingle();

      // marca como cancelada
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: nowIso(), updated_at: nowIso() })
        .eq('id', subscription_id);

      // se era a atual, tenta achar substituta ativa; senão, coloca empresa em free
      if (subRow?.actual_plan === 'yes') {
        const { data: replacement } = await supabaseAdmin
          .from('subscriptions')
          .select('id, plan_id')
          .eq('company_id', subRow.company_id)
          .eq('status', 'active')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (replacement) {
          await supabaseAdmin.from('subscriptions')
            .update({ actual_plan: 'no', updated_at: nowIso() })
            .eq('company_id', subRow.company_id)
            .neq('id', replacement.id);
          await supabaseAdmin.from('subscriptions')
            .update({ actual_plan: 'yes', updated_at: nowIso() })
            .eq('id', replacement.id);

          const { data: planRow } = await supabaseAdmin
            .from('plans')
            .select('slug, max_employees').eq('id', replacement.plan_id).maybeSingle();
          if (planRow) {
            await supabaseAdmin.from('companies')
              .update({ plan: planRow.slug, maxemployees: planRow.max_employees ?? null })
              .eq('id', subRow.company_id);
          }
        } else {
          await supabaseAdmin.from('companies')
            .update({ plan: 'free', maxemployees: 3 })
            .eq('id', subRow.company_id);
        }
      }
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

      await supabaseAdmin
        .from('subscriptions')
        .update({ actual_plan: 'no', updated_at: nowIso() })
        .eq('company_id', sub.company_id)
        .neq('id', subscription_id);

      await supabaseAdmin
        .from('subscriptions')
        .update({ actual_plan: 'yes', updated_at: nowIso() })
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

    // ================== NOVOS: PLANOS & LINKS ==================

    // Lista planos (com filtros opcionais)
    if (action === 'plans_list') {
      const { is_public, active } = (req.body ?? {}) as { is_public?: boolean; active?: boolean };
      let q = supabaseAdmin.from('plans').select('id, name, slug, description, price_cents, interval_months, trial_days, max_employees, efi_plan_id, currency, active, features_json, is_public').order('updated_at', { ascending: false });
      if (typeof is_public === 'boolean') q = q.eq('is_public', is_public);
      if (typeof active === 'boolean') q = q.eq('active', active);
      const { data, error } = await q;
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, plans: data ?? [] });
    }

    // Cria plano (privado por default) + cria plan_id na Efí
    if (action === 'plans_create') {
      const {
        name,
        slug,
        description = null,
        price_cents,
        interval_months = 1,
        trial_days = 0,
        max_employees = 5,
        is_public = false,
        active = true,
        features_json = null,
      } = req.body ?? {};

      if (!name || typeof price_cents !== 'number') {
        return res.status(400).json({ ok: false, error: 'name e price_cents são obrigatórios' });
      }
      if (interval_months <= 0) return res.status(400).json({ ok: false, error: 'interval_months deve ser > 0' });
      if (trial_days < 0 || max_employees < 0 || price_cents < 0) {
        return res.status(400).json({ ok: false, error: 'valores inválidos (negativos)' });
      }

      const api = await makeEfiApi();
      const created = await (api as any).createPlan({}, { name, interval: Number(interval_months), repeats: null });
      const efi_plan_id: number | null = created?.data?.plan_id ?? created?.plan_id ?? null;
      if (!efi_plan_id) return res.status(502).json({ ok: false, error: 'Falha ao criar plano na Efí' });

      const baseSlug = slug ? slugify(String(slug)) : slugify(String(name));
      const finalSlug = await ensureUniqueSlug(baseSlug);

      const { data, error } = await supabaseAdmin
        .from('plans')
        .insert({
          name,
          slug: finalSlug,
          description,
          price_cents: Number(price_cents),
          interval_months: Number(interval_months),
          trial_days: Number(trial_days),
          max_employees: Number(max_employees),
          efi_plan_id,
          currency: 'BRL',
          active: !!active,
          is_public: !!is_public,
          features_json: Array.isArray(features_json) ? features_json : (features_json ?? null),
          created_at: nowIso(),
          updated_at: nowIso(),
        } as any)
        .select('id, name, slug, price_cents, interval_months, trial_days, max_employees, efi_plan_id, is_public, active')
        .single();

      if (error) {
        const hint = /column "is_public" does not exist/i.test(error.message)
          ? 'Crie a coluna is_public conforme a migration enviada.'
          : undefined;
        return res.status(500).json({ ok: false, error: error.message, hint });
      }
      return res.status(200).json({ ok: true, plan: data });
    }

    // Atualiza um plano existente (inclui is_public, active, preço etc.)
    if (action === 'plans_update') {
      const { id, patch } = req.body as { id: string; patch: any };
      if (!id || !patch || typeof patch !== 'object') return res.status(400).json({ ok: false, error: 'id e patch são obrigatórios' });

      const toUpdate: any = {};
      const allowed = ['name','slug','description','price_cents','interval_months','trial_days','max_employees','active','is_public','features_json'];
      for (const k of allowed) if (k in patch) toUpdate[k] = patch[k];
      if ('slug' in toUpdate && toUpdate.slug) {
        toUpdate.slug = await ensureUniqueSlug(slugify(String(toUpdate.slug)));
      }
      toUpdate.updated_at = nowIso();

      const { data, error } = await supabaseAdmin
        .from('plans')
        .update(toUpdate)
        .eq('id', id)
        .select('id, name, slug, price_cents, interval_months, trial_days, max_employees, efi_plan_id, is_public, active, updated_at')
        .single();

      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true, plan: data });
    }

    // Gera URL de checkout empresa+plano
    if (action === 'checkout_link') {
      const { plan_id, company_id } = req.body as { plan_id: string; company_id: string };
      if (!plan_id || !company_id) return res.status(400).json({ ok: false, error: 'plan_id e company_id são obrigatórios' });

      // valida se existem (opcional, mas útil)
      const { data: p } = await supabaseAdmin.from('plans').select('id').eq('id', plan_id).maybeSingle();
      const { data: c } = await supabaseAdmin.from('companies').select('id').eq('id', company_id).maybeSingle();
      if (!p || !c) return res.status(404).json({ ok: false, error: 'plano ou empresa não encontrados' });

      const base = getBaseUrl(req);
      const url = `${base}/checkout?planId=${encodeURIComponent(plan_id)}&companyId=${encodeURIComponent(company_id)}`;
      return res.status(200).json({ ok: true, url });
    }

    return res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'action failed' });
  }
}
