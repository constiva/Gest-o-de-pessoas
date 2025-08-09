import { ReactNode } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-6 bg-white min-h-screen">{children}</main>
    </div>
  );
}
