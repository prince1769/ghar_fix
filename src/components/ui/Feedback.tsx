import { useState, useCallback, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type Toast = { id: number; type: 'success' | 'error' | 'info'; msg: string };

let listeners: ((t: Toast) => void)[] = [];
let counter = 0;

export function toast(msg: string, type: Toast['type'] = 'success') {
  const t = { id: ++counter, type, msg };
  listeners.forEach((l) => l(t));
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useState(() => {
    listeners.push((t: Toast) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => remove(t.id), 3500);
    });
    return undefined;
  });

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[92%] max-w-sm">
      {items.map((t) => (
        <div
          key={t.id}
          className="animate-slide-up flex items-start gap-3 rounded-2xl bg-white shadow-card border border-ink-100 px-4 py-3"
        >
          {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
          {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
          {t.type === 'info' && <Info className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />}
          <p className="text-sm text-ink-700 flex-1">{t.msg}</p>
          <button onClick={() => remove(t.id)} className="text-ink-400 hover:text-ink-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-block animate-spin rounded-full border-2 border-ink-200 border-t-brand-600 ${className}`} style={{ width: '1em', height: '1em' }} />
  );
}

export function LoadingScreen({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Spinner className="w-8 h-8 text-brand-600" />
      <p className="text-sm text-ink-500">{label}</p>
    </div>
  );
}

export function EmptyState({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-16 h-16 rounded-2xl bg-ink-100 flex items-center justify-center text-ink-400 mb-4">
        {icon}
      </div>
      <p className="font-semibold text-ink-700">{title}</p>
      {sub && <p className="text-sm text-ink-500 mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}
