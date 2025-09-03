import { useRouter } from 'next/router';
import { CheckCircle } from 'lucide-react';

export default function ApplyThanks() {
  const router = useRouter();
  const { name, job } = router.query;
  const first = Array.isArray(name) ? name[0] : name || '';
  const jobTitle = Array.isArray(job) ? job[0] : job || '';
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
      <CheckCircle className="h-16 w-16 text-purple-600 mb-4" />
      <h1 className="text-2xl font-bold mb-2">
        Obrigado{first ? `, ${first}` : ''}!
      </h1>
      <p className="mb-6">
        Sua inscrição para a vaga <span className="font-medium">{jobTitle}</span> foi um sucesso!
      </p>
    </div>
  );
}
