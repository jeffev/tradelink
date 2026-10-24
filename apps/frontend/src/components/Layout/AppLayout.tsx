import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import DemoBanner from './DemoBanner';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <DemoBanner />
        <Outlet />
      </main>
    </div>
  );
}
