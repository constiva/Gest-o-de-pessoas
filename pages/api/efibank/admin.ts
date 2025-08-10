import type { NextApiRequest, NextApiResponse } from 'next';
import {
  logDebug,
  createPlan,
  listPlans,
  updatePlan,
  cancelPlan,
  createSubscription,
  paySubscription,
  getSubscription,
  listCharges,
  retryCharge,
  updateSubscription,
  cancelSubscription
} from '../../../lib/efibank';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { action, params } = req.body;
  try {
    logDebug(`admin action ${action}`, params);
    let data;
    switch (action) {
      case 'createPlan':
        data = await createPlan(params.name, params.interval, params.repeats);
        break;
      case 'listPlans':
        data = await listPlans(params);
        break;
      case 'updatePlan':
        data = await updatePlan(params.id, params.name);
        break;
      case 'cancelPlan':
        data = await cancelPlan(params.id);
        break;
      case 'createSubscription':
        data = await createSubscription(params.planId, params.items);
        break;
      case 'paySubscription':
        data = await paySubscription(params.subId, params.payload);
        break;
      case 'getSubscription':
        data = await getSubscription(params.id);
        break;
      case 'listCharges':
        data = await listCharges(params);
        break;
      case 'retryCharge':
        data = await retryCharge(params.id, params.payload);
        break;
      case 'updateSubscription':
        data = await updateSubscription(params.id, params.body);
        break;
      case 'cancelSubscription':
        data = await cancelSubscription(params.id);
        break;
      default:
        return res.status(400).json({ error: 'unknown_action' });
    }
    logDebug(`admin action ${action} success`, data);
    res.status(200).json({ data });
  } catch (err) {
    logDebug(`admin action ${action} error`, err instanceof Error ? err : { err });
    res.status(500).json({ error: 'admin_failed' });
  }
}
