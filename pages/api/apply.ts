import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, serviceRoleKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { job_id, data } = req.body as { job_id: string; data: Record<string, any> };

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('company_id')
    .eq('id', job_id)
    .single();

  if (jobError || !job) {
    return res.status(400).json({ error: jobError?.message || 'Vaga não encontrada' });
  }

  const talentPayload = { company_id: job.company_id, ...data };

  let talentId: string | undefined;
  if (data.email) {
    const { data: existingByEmail } = await supabase
      .from('talents')
      .select('id')
      .eq('company_id', job.company_id)
      .eq('email', data.email)
      .maybeSingle();
    talentId = existingByEmail?.id;
  }

  if (!talentId && data.phone) {
    const { data: existingByPhone } = await supabase
      .from('talents')
      .select('id')
      .eq('company_id', job.company_id)
      .eq('phone', data.phone)
      .maybeSingle();
    talentId = existingByPhone?.id;
  }

  let talent;
  if (talentId) {
    const { data: updated, error: tErr } = await supabase
      .from('talents')
      .update(talentPayload)
      .eq('id', talentId)
      .select('id')
      .single();
    if (tErr || !updated) {
      return res.status(400).json({ error: tErr?.message || 'Erro ao salvar talento' });
    }
    talent = updated;
  } else {
    const { data: inserted, error: tErr } = await supabase
      .from('talents')
      .insert(talentPayload)
      .select('id')
      .single();
    if (tErr || !inserted) {
      return res.status(400).json({ error: tErr?.message || 'Erro ao salvar talento' });
    }
    talent = inserted;
  }

  // ensure stages exist and get the first stage (Listados)
  let { data: stages } = await supabase
    .from('job_stages')
    .select('id,position')
    .eq('company_id', job.company_id)
    .eq('job_id', job_id)
    .order('position');
  if (!stages || stages.length === 0) {
    const DEFAULT_STAGES = [
      { name: 'Listados', position: 1, sla_days: 2 },
      { name: 'Triagem Curricular', position: 2, sla_days: 3 },
      { name: 'Triagem Técnica', position: 3, sla_days: 5 },
      { name: 'Entrevista Final', position: 4, sla_days: 7 },
      { name: 'Oferta', position: 5, sla_days: 2 },
      { name: 'Admitido', position: 6, sla_days: null },
    ];
    const { data: inserted } = await supabase
      .from('job_stages')
      .insert(
        DEFAULT_STAGES.map((s) => ({ ...s, company_id: job.company_id, job_id }))
      )
      .select('id,position')
      .order('position');
    stages = inserted || [];
  }
  const firstStage = stages.find((s) => s.position === 1);

  const { error: appError } = await supabase
    .from('applications')
    .insert({
      company_id: job.company_id,
      job_id,
      talent_id: talent.id,
      stage_id: firstStage?.id || null,
    });

  if (appError) {
    return res.status(400).json({ error: appError.message });
  }

  return res.status(200).json({ success: true });
}
