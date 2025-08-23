import { ReactNode } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-brand-light/20 to-gray-50 text-gray-900 dark:from-gray-900 dark:to-gray-900 dark:text-gray-100">
      <Sidebar />
      <main className="flex-1 min-w-0 p-8">
        <div className="max-w-7xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
