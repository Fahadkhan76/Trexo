import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { useMunimStore } from '../store/useMunimStore';

export function ToastContainer() {
  const toasts = useMunimStore((s) => s.toasts);
  const dismissToast = useMunimStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md no-print"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.tone === 'success'
            ? CheckCircle2
            : toast.tone === 'warning'
              ? AlertTriangle
              : toast.tone === 'error'
                ? XCircle
                : Info;
        const toneClasses =
          toast.tone === 'success'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
            : toast.tone === 'warning'
              ? 'border-amber-300 bg-amber-50 text-amber-950'
              : toast.tone === 'error'
                ? 'border-red-300 bg-red-50 text-red-950'
                : 'border-[#D6CFC0] bg-[#FFFDF8] text-[#0F172A]';

        return (
          <div
            key={toast.id}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg ${toneClasses}`}
          >
            <div className="flex items-center gap-2.5 text-base font-medium">
              <Icon className="h-5 w-5 shrink-0" />
              <span>{toast.message}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {toast.undoLabel && toast.onUndo && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onUndo?.();
                    dismissToast(toast.id);
                  }}
                  className="min-h-[40px] rounded-lg bg-[#0F172A] px-3 py-1 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  {toast.undoLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-black/5"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
