import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';

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
    <div className="min-h-screen flex items-center justify-center bg-purple-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-full max-w-md space-y-2">
        <h1 className="text-2xl font-bold text-center mb-4">Registrar empresa</h1>
        <input name="companyName" placeholder="Empresa" onChange={handleChange} className="w-full border p-2 rounded" />
        <input name="plan" placeholder="Plano" onChange={handleChange} className="w-full border p-2 rounded" />
        <input name="maxEmployees" placeholder="Máx. funcionários" onChange={handleChange} className="w-full border p-2 rounded" />
        <input name="name" placeholder="Seu nome" onChange={handleChange} className="w-full border p-2 rounded" />
        <input name="phone" placeholder="Telefone" onChange={handleChange} className="w-full border p-2 rounded" />
        <input name="email" placeholder="Email" onChange={handleChange} className="w-full border p-2 rounded" />
        <input name="password" type="password" placeholder="Senha" onChange={handleChange} className="w-full border p-2 rounded" />
        <Button type="submit" className="w-full">Registrar</Button>
        <p className="text-center text-sm">
          Já tem conta? <a href="/login" className="text-brand">Entrar</a>
        </p>
      </form>
    </div>
  );
}
