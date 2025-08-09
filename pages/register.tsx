import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { UserPlus } from 'lucide-react';

interface SignUpForm {
  companyName: string;
  plan: string;
  maxEmployees: string;
  name: string;
  phone: string;
  email: string;
  password: string;
}

export default function Register() {
  const [form, setForm] = useState<SignUpForm>({
    companyName: '',
    plan: '',
    maxEmployees: '',
    name: '',
    phone: '',
    email: '',
    password: ''
  });
  const router = useRouter();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password
    });
    if (authError) {
      alert(authError.message);
      return;
    }
    const userId = authData.user.id;
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: form.companyName,
        email: form.email,
        phone: form.phone,
        plan: form.plan,
        maxemployees: parseInt(form.maxEmployees, 10)
      })
      .select()
      .single();
    if (companyError) {
      alert(companyError.message);
      return;
    }
    const { error: userError } = await supabase.from('users').insert({
      id: userId,
      name: form.name,
      phone: form.phone,
      email: form.email,
      company_id: company.id
    });
    if (userError) {
      alert(userError.message);
      return;
    }
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center flex items-center justify-center gap-2">
          <UserPlus className="h-6 w-6" /> Registrar empresa
        </h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input name="companyName" placeholder="Empresa" onChange={handleChange} />
          <Input name="plan" placeholder="Plano" onChange={handleChange} />
          <Input name="maxEmployees" placeholder="Máx. funcionários" onChange={handleChange} />
          <Input name="name" placeholder="Seu nome" onChange={handleChange} />
          <Input name="phone" placeholder="Telefone" onChange={handleChange} />
          <Input name="email" placeholder="Email" onChange={handleChange} />
          <Input name="password" type="password" placeholder="Senha" onChange={handleChange} />
          <Button type="submit" className="w-full">Registrar</Button>
        </form>
        <p className="text-center text-sm">
          Já tem conta? <a href="/login" className="text-brand hover:underline">Entrar</a>
        </p>
      </Card>
    </div>
  );
}
