import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from './supabaseAdmin'

const VALID_ALLOWED = ['name','email','phone','position','salary','cpf'] as const

export async function requireUser(req: NextApiRequest, res: NextApiResponse){
  const auth = req.headers.authorization
  if(!auth) {
    res.status(401).json({error:'missing token'})
    throw new Error('unauthenticated')
  }
  const token = auth.replace('Bearer ','')
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if(error || !data.user){
    res.status(401).json({error: 'invalid token'})
    throw new Error('unauthenticated')
  }
  return data.user
}

function sanitizeAllowed(input: any): string[]{
  if(Array.isArray(input)) return Array.from(new Set(input.map(String)))
  return []
}

export async function getContext(userId: string, companyId?: string){
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()
  const superadmin = !!userRow?.is_admin

  let link
  if(companyId){
    const { data } = await supabaseAdmin
      .from('companies_users')
      .select('company_id, role, scopes, allowed_fields')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .maybeSingle()
    link = data
  } else {
    const { data } = await supabaseAdmin
      .from('companies_users')
      .select('company_id, role, scopes, allowed_fields')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    link = data
  }
  if(!link) throw new Error('company_not_found')
  const allowed = sanitizeAllowed(link.allowed_fields).filter(f =>
    (VALID_ALLOWED as readonly string[]).includes(f)
  )
  return {
    userId,
    companyId: link.company_id,
    role: link.role,
    scopes: link.scopes || {},
    allowedFields: allowed,
    superadmin
  }
}

export function can(ctx: any){
  const adminLike = ctx.superadmin || ctx.role === 'owner' || ctx.role === 'admin'
  return {
    adminLike,
    employees: {
      read: adminLike || ctx.scopes?.employees?.read,
      create: adminLike || ctx.scopes?.employees?.create,
      update: adminLike || ctx.scopes?.employees?.update,
      update_salary: adminLike || ctx.scopes?.employees?.update_salary,
      dismiss: adminLike || ctx.scopes?.employees?.dismiss,
      activate: adminLike || ctx.scopes?.employees?.activate,
      deactivate: adminLike || ctx.scopes?.employees?.deactivate,
      delete: adminLike || ctx.scopes?.employees?.delete,
      export: adminLike || ctx.scopes?.employees?.export,
    },
    metrics: {
      read: adminLike || ctx.scopes?.metrics?.read,
    },
    reports: {
      read: adminLike || ctx.scopes?.reports?.read,
      export: adminLike || ctx.scopes?.reports?.export,
    }
  }
}

export function maskEmployees(list: any[], allowed: string[]){
  const set = new Set(allowed)
  return list.map(emp => ({
    ...emp,
    name: set.has('name') ? emp.name : null,
    email: set.has('email') ? emp.email : null,
    phone: set.has('phone') ? emp.phone : null,
    position: set.has('position') ? emp.position : null,
    salary: set.has('salary') ? emp.salary : null,
    cpf: set.has('cpf') ? emp.cpf : null,
  }))
}
