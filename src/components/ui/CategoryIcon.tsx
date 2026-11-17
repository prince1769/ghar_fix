import * as Icons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

export function CategoryIcon({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
  const Comp = (Icons as unknown as Record<string, React.ComponentType<LucideProps>>)[name] ?? Icons.Wrench;
  return (
    <div
      className="rounded-2xl flex items-center justify-center shrink-0"
      style={{ width: size + 18, height: size + 18, background: color + '1a' }}
    >
      <Comp size={size} color={color} strokeWidth={2} />
    </div>
  );
}
