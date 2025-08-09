import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      return;
    }
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-full max-w-sm space-y-2">
        <h1 className="text-2xl font-bold text-center mb-4">Entrar</h1>
        <input name="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} className="w-full border p-2 rounded" />
        <input
          name="password"
          type="password"
          placeholder="Senha"
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <Button type="submit" className="w-full">Login</Button>
        <p className="text-center text-sm">
          Não tem conta? <a href="/register" className="text-brand">Registre-se</a>
        </p>
      </form>
    </div>
  );
}
