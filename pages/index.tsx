import EmployeeStats from '../components/EmployeeStats';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-white to-purple-50 p-4">
      <h1 className="text-4xl font-bold text-brand mb-8">Constiva</h1>
      <EmployeeStats active={2} inactive={0} dismissed={0} />
      <div className="mt-8 space-x-4">
        <a href="/login" className="text-brand underline">Login</a>
        <a href="/register" className="text-brand underline">Registrar</a>
      </div>
    </div>
  );
}
