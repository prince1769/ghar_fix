import { Wrench } from 'lucide-react';

export function Logo({ size = 'md', light = false }: { size?: 'sm' | 'md' | 'lg'; light?: boolean }) {
  const dim = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const text = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-xl';
  return (
    <div className="flex items-center gap-2">
      <div className={`${dim} rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center shadow-glow`}>
        <Wrench className="text-white" size={size === 'lg' ? 24 : size === 'sm' ? 16 : 18} strokeWidth={2.5} />
      </div>
      <span className={`${text} font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink-900'}`}>
        Ghar<span className="text-accent-500">Fix</span>
      </span>
    </div>
  );
}
