import type { NextApiRequest, NextApiResponse } from 'next';
import { createEfibankSubscription } from '../../../lib/efibank';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { plan, customer, card } = req.body;
    const sub = await createEfibankSubscription(plan, customer, card);
    res.status(200).json(sub);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'subscription_failed' });
  }
}
