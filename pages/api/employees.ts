import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { requireUser, getContext, can, maskEmployees } from '../../lib/context'

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try{
    const user = await requireUser(req, res)
    const ctx = await getContext(user.id)
    const permissions = can(ctx)

    if(req.method === 'GET'){
      if(!permissions.employees.read) return res.status(403).json({error:'forbidden'})
      const { data, error } = await supabaseAdmin
        .from('employees')
        .select('*')
        .eq('company_id', ctx.companyId)
      if(error) return res.status(500).json({error: error.message})
      const result = permissions.adminLike ? data : maskEmployees(data||[], ctx.allowedFields)
      return res.status(200).json({ ok: true, data: result })
    }

    if(req.method === 'POST'){
      if(!permissions.employees.create) return res.status(403).json({error:'forbidden'})
      const payload = req.body || {}
      payload.company_id = ctx.companyId
      const { data, error } = await supabaseAdmin
        .from('employees')
        .insert(payload)
        .select()
        .single()
      if(error) return res.status(500).json({error: error.message})
      return res.status(200).json({ ok: true, data })
    }

    return res.status(405).end()
  }catch(err){
    if(!res.writableEnded) res.status(500).json({error:'unexpected'})
  }
}
