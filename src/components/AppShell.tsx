import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Calculator,
  Eye,
  EyeOff,
  Package,
  RotateCcw,
  Sparkles,
  Wifi,
  WifiOff,
  BookOpen,
} from 'lucide-react';
import { APP_CONFIG } from '../config';
import { getDictionary } from '../i18n';
import { useMunimStore } from '../store/useMunimStore';
import type { Language } from '../types';
import { formatHeaderDate } from '../utils/dates';
import { ConfirmDialog } from './ConfirmDialog';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const language = useMunimStore((s) => s.language);
  const setLanguage = useMunimStore((s) => s.setLanguage);
  const privacyHidden = useMunimStore((s) => s.privacyHidden);
  const togglePrivacy = useMunimStore((s) => s.togglePrivacy);
  const isOnline = useMunimStore((s) => s.isOnline);
  const setOnlineStatus = useMunimStore((s) => s.setOnlineStatus);
  const resetDemoData = useMunimStore((s) => s.resetDemoData);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const dict = getDictionary(language);

  useEffect(() => {
    const onOnline = () => setOnlineStatus(true);
    const onOffline = () => setOnlineStatus(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [setOnlineStatus]);

  const navItems = [
    { to: '/', label: dict.navCounter, icon: Calculator },
    { to: '/inventory', label: dict.navInventory, icon: Package },
    { to: '/restock', label: dict.navRestock, icon: Sparkles },
  ];

  const langOptions: { code: Language; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'hi', label: 'हिं' },
    { code: 'kn', label: 'ಕ' },
  ];

  return (
    <div className="flex min-h-screen bg-[#FAF7F0] text-[#0F172A]">
      {/* Slim Left Sidebar */}
      <aside className="no-print flex w-48 xl:w-56 shrink-0 flex-col justify-between border-r border-[#E5DFD3] bg-[#FFFDF8] p-4">
        <div>
          <div className="flex items-center gap-2.5 px-1 pb-4 pt-1 border-b border-[#E5DFD3]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0F172A] text-[#FAF7F0]">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold leading-tight text-[#0F172A]">
                {dict.appTitle}
              </div>
              <div className="text-xs text-[#475569] leading-snug">
                {dict.tagline}
              </div>
            </div>
          </div>

          <nav className="mt-5 flex flex-col gap-1.5" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-base font-semibold transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#0F172A] text-[#FAF7F0]'
                        : 'text-[#0F172A] hover:bg-[#F4EFE4]'
                    }`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="rounded-lg bg-[#F4EFE4] border border-[#E5DFD3] p-3 text-sm text-[#475569]">
          <p className="font-medium text-[#0F172A]">Device Storage</p>
          <p className="mt-1 text-xs leading-snug">{dict.connectivityNote}</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[#E5DFD3] bg-[#FFFDF8] px-5 py-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-[#0F172A] truncate">
                {APP_CONFIG.STORE_NAME}
              </h1>
              <div className="flex items-center gap-2 text-sm text-[#475569]">
                <span>{formatHeaderDate(new Date())}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 font-medium">
                  {isOnline ? (
                    <>
                      <Wifi className="h-4 w-4 text-emerald-700" />
                      <span className="text-emerald-800">{dict.onlineLabel}</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-amber-700" />
                      <span className="text-amber-800">{dict.offlineLabel}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Language switcher (EN primary in Phases 1-6; HI & KN full dictionaries in Phase 7) */}
            <div
              className="flex items-center rounded-lg border border-[#D6CFC0] bg-[#FAF7F0] p-0.5"
              role="group"
              aria-label="Select language"
            >
              {langOptions.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setLanguage(opt.code)}
                  className={`min-h-[36px] rounded-md px-2.5 py-1 text-sm font-semibold transition-colors whitespace-nowrap ${
                    language === opt.code
                      ? 'bg-[#0F172A] text-white'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Privacy Eye Toggle */}
            <button
              type="button"
              onClick={togglePrivacy}
              className={`flex min-h-[40px] items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                privacyHidden
                  ? 'border-slate-900 bg-[#0F172A] text-white'
                  : 'border-[#D6CFC0] bg-white text-[#0F172A] hover:bg-[#F4EFE4]'
              }`}
              title={privacyHidden ? dict.privacyShow : dict.privacyHide}
            >
              {privacyHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span>{privacyHidden ? dict.privacyShow : dict.privacyHide}</span>
            </button>

            <span className="text-sm font-medium text-[#475569] px-1 whitespace-nowrap">
              {dict.demoDataBadge}
            </span>

            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D6CFC0] bg-white px-3 py-1.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F4EFE4] whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{dict.resetDemoData}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 min-w-0">{children}</main>
      </div>

      <ConfirmDialog
        open={confirmResetOpen}
        title={dict.resetConfirmTitle}
        description={dict.resetConfirmBody}
        confirmLabel={dict.resetConfirmAction}
        cancelLabel={dict.cancel}
        tone="danger"
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={() => {
          setConfirmResetOpen(false);
          void resetDemoData();
        }}
      />
    </div>
  );
}
