import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { requireUser, getContext, can } from '../../lib/context'

const VALID_ALLOWED = ['name','email','phone','position','salary','cpf'] as const

function normalizeAllowedFields(input: unknown): string[] {
  if (Array.isArray(input)) return Array.from(new Set(input.map(String)))
  if (typeof input === 'string') return [input]
  return []
}

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    const user = await requireUser(req,res)
    const ctx = await getContext(user.id)
    const perms = can(ctx)
    if(!perms.adminLike) return res.status(403).json({error:'forbidden'})

    switch(req.method){
      case 'GET': {
        const { data, error } = await supabaseAdmin
          .from('companies_users')
          .select('user_id,name,email,phone,position,scopes,allowed_fields')
          .eq('company_id', ctx.companyId)
        if(error) return res.status(500).json({error: error.message})
        const { data: posData } = await supabaseAdmin
          .from('employees')
          .select('position')
          .eq('company_id', ctx.companyId)
          .not('position','is', null)
        const positions = Array.from(new Set((posData||[]).map((r:any)=>r.position)))
        return res.status(200).json({ company_id: ctx.companyId, users: data||[], positions })
      }
      case 'POST': {
        const { name, email, password, phone, position } = req.body
        if(!name || !email || !password) return res.status(400).json({error:'Missing fields'})
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          phone: phone || undefined,
          email_confirm: true
        })
        if(error || !data.user) return res.status(400).json({error: error?.message})
        const { error: linkError } = await supabaseAdmin
          .from('companies_users')
          .insert({
            company_id: ctx.companyId,
            user_id: data.user.id,
            name,
            email,
            phone: phone || null,
            position: position || null,
            scopes: {},
            allowed_fields: []
          })
        if(linkError) return res.status(400).json({error: linkError.message})
        return res.status(200).json({ ok:true, data:{ user_id: data.user.id } })
      }
      case 'PUT': {
        const { user_id, allowed_fields, scopes, name, email, phone, position, password } = req.body
        if(!user_id) return res.status(400).json({error:'Missing user_id'})
        if(email || password || phone){
          const authUpdates: { email?: string; password?: string; phone?: string } = {}
          if(email) authUpdates.email = email
          if(password) authUpdates.password = password
          if(phone) authUpdates.phone = phone
          const { error: auErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdates)
          if(auErr) return res.status(400).json({error: auErr.message})
        }
        const rawAllowed = normalizeAllowedFields(allowed_fields)
        const sanitizedAllowed = rawAllowed.filter(f => VALID_ALLOWED.includes(f as any))
        const updates: any = {
          allowed_fields: sanitizedAllowed,
          scopes: scopes || {}
        }
        if(name) updates.name = name
        if(phone) updates.phone = phone
        if(position) updates.position = position
        if(email) updates.email = email
        const { data: updated, error: upErr } = await supabaseAdmin
          .from('companies_users')
          .update(updates)
          .eq('company_id', ctx.companyId)
          .eq('user_id', user_id)
          .select('user_id, company_id, role, scopes, allowed_fields')
          .single()
        if(upErr) return res.status(400).json({error: upErr.message})
        return res.status(200).json({ ok:true, data: updated })
      }
      case 'DELETE': {
        const { id } = req.query
        if(!id || typeof id !== 'string') return res.status(400).json({error:'Missing id'})
        await supabaseAdmin
          .from('companies_users')
          .delete()
          .eq('company_id', ctx.companyId)
          .eq('user_id', id)
        await supabaseAdmin.auth.admin.deleteUser(id)
        return res.status(200).json({ ok:true })
      }
      default:
        return res.status(405).end()
    }
  }catch(err){
    if(!res.writableEnded) res.status(500).json({error:'unexpected'})
  }
}
