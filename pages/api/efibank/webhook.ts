import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';
import { PLAN_LIMITS } from '../../../lib/utils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return res.status(405).end();
  const { subscription_id, status } = req.body;
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
    }
  }
  res.status(200).json({ received: true });
}
