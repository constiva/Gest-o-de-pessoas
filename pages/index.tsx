import EmployeeStats from '../components/EmployeeStats';
import { Button } from '../components/ui/button';
import { LogIn, UserPlus } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-brand/10 via-transparent to-transparent">
      <h1 className="text-5xl font-extrabold text-brand mb-2">Constiva</h1>
      <p className="mb-10 text-gray-600 dark:text-gray-300 text-lg text-center">Gestão de pessoas moderna e intuitiva</p>
      <EmployeeStats active={2} inactive={0} dismissed={0} />
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <a href="/login" className="flex items-center gap-2"><LogIn className="h-4 w-4" /> Login</a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/register" className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Registrar</a>
        </Button>
      </div>
    </div>
  );
}
