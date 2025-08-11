import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { PLAN_LIMITS } from '../../../lib/utils';
import fs from 'fs';
import path from 'path';

const DEBUG_PATH = path.join(process.cwd(), 'debugCheckout.txt');

function logDebug(msg: string, data?: unknown) {
  const line = `[${new Date().toISOString()}] ${msg}` +
    (data ? ` ${JSON.stringify(data)}` : '') + '\n';
  fs.appendFileSync(DEBUG_PATH, line);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return res.status(405).end();
  const { subscription_id, status } = req.body;
  logDebug('Webhook received', { subscription_id, status });
  if (status === 'paid') {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('efibank_id', subscription_id)
      .single();
    if (sub) {
      await supabase
        .from('subscriptions')
        .update({ status: 'active' })
        .eq('id', sub.id);
      const limit = PLAN_LIMITS[sub.plan as keyof typeof PLAN_LIMITS];
      await supabase
        .from('companies')
        .update({ maxemployees: limit })
        .eq('id', sub.company_id);
      logDebug('Subscription activated', { company: sub.company_id, limit });
    }
  }
  res.status(200).json({ received: true });
}
