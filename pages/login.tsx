import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      alert(error.message);
      return;
    }
    const userId = data.user?.id;
    let companyId: string | undefined;
    let companyRole = 'viewer';

    const { data: profile } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      companyId = profile.company_id;
      companyRole = 'admin';
    } else {
      const { data: compUser } = await supabase
        .from('companies_users')
        .select('company_id, role')
        .eq('user_id', userId)
        .maybeSingle();

      if (compUser) {
        companyId = compUser.company_id;
        companyRole = compUser.role;
      } else {
        const { data: unitUser } = await supabase
          .from('companies_units')
          .select('company_id')
          .eq('user_id', userId)
          .maybeSingle();

        companyId = unitUser?.company_id;
        companyRole = 'manager';
      }
    }

    if (companyId) {
      await supabase.auth.updateUser({
        data: { company_id: companyId, company_role: companyRole },
      });
    }
    const { data: company } = await supabase
      .from('companies')
      .select('maxemployees')
      .eq('id', companyId)
      .single();
    if (company?.maxemployees === 0) {
      router.push(`/pending?companyId=${companyId}`);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center flex items-center justify-center gap-2">
          <LogIn className="h-6 w-6" /> Entrar
        </h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input name="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <Input
            name="password"
            type="password"
            placeholder="Senha"
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full">Entrar</Button>
        </form>
        <p className="text-center text-sm">
          Não tem conta? <a href="/register" className="text-brand hover:underline">Registre-se</a>
        </p>
      </Card>
    </div>
  );
}
