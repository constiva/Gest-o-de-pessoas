import type { NextApiRequest, NextApiResponse } from 'next';
import { createEfibankSubscription } from '../../../lib/efibank';
import fs from 'fs';
import path from 'path';

const DEBUG_PATH = path.join(process.cwd(), 'debugCheckout.txt');

function logDebug(msg: string, data?: unknown) {
  const line = `[${new Date().toISOString()}] ${msg}` +
    (data ? ` ${JSON.stringify(data)}` : '') + '\n';
  fs.appendFileSync(DEBUG_PATH, line);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { plan, customer, card } = req.body;
    logDebug('API /efibank/subscribe called', { plan, customer });
    const sub = await createEfibankSubscription(plan, customer, card);
    logDebug('API /efibank/subscribe success', sub);
    res.status(200).json(sub);
  } catch (err) {
    logDebug('API /efibank/subscribe error', err instanceof Error ? err : { err });
    res.status(500).json({ error: 'subscription_failed' });
  }
}
