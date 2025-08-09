import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

interface SignUpForm {
  companyName: string;
  plan: string;
  maxEmployees: string;
  name: string;
  phone: string;
  email: string;
  password: string;
}

export default function Home() {
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
    <div>
      <h1>Cadastro</h1>
      <form onSubmit={handleSubmit}>
        <input name="companyName" placeholder="Company" onChange={handleChange} />
        <input name="plan" placeholder="Plan" onChange={handleChange} />
        <input name="maxEmployees" placeholder="Max Employees" onChange={handleChange} />
        <input name="name" placeholder="Your name" onChange={handleChange} />
        <input name="phone" placeholder="Phone" onChange={handleChange} />
        <input name="email" placeholder="Email" onChange={handleChange} />
        <input name="password" type="password" placeholder="Password" onChange={handleChange} />
        <button type="submit">Registrar</button>
      </form>
      <a href="/login">Já tem conta? Login</a>
    </div>
  );
}
