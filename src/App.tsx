import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ActionDrawers } from './components/ActionDrawers';
import { AppShell } from './components/AppShell';
import { ToastContainer } from './components/ToastContainer';
import { CounterPage } from './pages/CounterPage';
import { InventoryPage } from './pages/InventoryPage';
import { TrexoPage } from './pages/TrexoPage';
import { useMunimStore } from './store/useMunimStore';

export default function App() {
  const setActiveDrawer = useMunimStore((s) => s.setActiveDrawer);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDrawer(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveDrawer]);

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<CounterPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/restock" element={<TrexoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
      <ActionDrawers />
      <ToastContainer />
    </BrowserRouter>
  );
}
