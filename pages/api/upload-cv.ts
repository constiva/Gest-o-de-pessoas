import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
);

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { fileName, base64 } = req.body as { fileName?: string; base64?: string };
  if (!fileName || !base64) return res.status(400).json({ error: 'missing file' });

  const ext = fileName.split('.').pop();
  const path = `cv-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(base64, 'base64');

  // ensure bucket exists
  const { data: bucket } = await supabase.storage.getBucket('cvs');
  if (!bucket) {
    await supabase.storage.createBucket('cvs', { public: true });
  }

  const { error } = await supabase.storage
    .from('cvs')
    .upload(path, buffer, { contentType: 'application/pdf' });
  if (error) return res.status(500).json({ error: error.message });

  const { data } = supabase.storage.from('cvs').getPublicUrl(path);
  return res.status(200).json({ url: data.publicUrl });
}
