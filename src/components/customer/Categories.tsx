import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { LoadingScreen, EmptyState } from '@/components/ui/Feedback';
import { inr } from '@/lib/format';
import type { ServiceCategory, Service } from '@/lib/types';
import { ArrowLeft, Search, ChevronRight, Clock } from 'lucide-react';

type Go = (view: string, params?: Record<string, string>) => void;

export function CategoriesList({ go }: { go: Go }) {
  const [cats, setCats] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    supabase.from('service_categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => { setCats((data as ServiceCategory[]) ?? []); setLoading(false); });
  }, []);

  const filtered = cats.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen bg-ink-50 pb-24">
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-ink-100">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => go('home')} className="p-2 -ml-2"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-bold">All services</h1>
        </div>
        <div className="flex items-center gap-2 bg-ink-100 rounded-2xl px-4 py-2.5">
          <Search size={18} className="text-ink-400" />
          <input placeholder="Search services..." className="flex-1 bg-transparent outline-none text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {loading ? <LoadingScreen /> : (
        <div className="px-5 mt-4 space-y-3">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => go('category', { id: c.id })} className="w-full card p-4 flex items-center gap-4 text-left active:scale-[0.98] transition">
              <CategoryIcon name={c.icon_name} color={c.color} size={28} />
              <div className="flex-1">
                <p className="font-bold text-ink-900">{c.name}</p>
                <p className="text-xs text-ink-500 line-clamp-1">{c.description}</p>
              </div>
              <ChevronRight className="text-ink-300" size={18} />
            </button>
          ))}
          {filtered.length === 0 && <EmptyState icon={<Search size={28} />} title="No matches" />}
        </div>
      )}
    </div>
  );
}

export function CategoryDetail({ categoryId, go }: { categoryId: string; go: Go }) {
  const [cat, setCat] = useState<ServiceCategory | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: s }] = await Promise.all([
        supabase.from('service_categories').select('*').eq('id', categoryId).maybeSingle(),
        supabase.from('services').select('*').eq('category_id', categoryId).eq('is_active', true).order('sort_order'),
      ]);
      setCat((c as ServiceCategory) ?? null);
      setServices((s as Service[]) ?? []);
      setLoading(false);
    })();
  }, [categoryId]);

  if (loading) return <LoadingScreen />;
  if (!cat) return <EmptyState icon={<Search size={28} />} title="Category not found" />;

  return (
    <div className="min-h-screen bg-ink-50 pb-24">
      <div className="text-white px-5 pt-6 pb-8 rounded-b-3xl" style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.color}dd)` }}>
        <button onClick={() => go('categories')} className="p-2 -ml-2 mb-3"><ArrowLeft size={20} /></button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
            <CategoryIcon name={cat.icon_name} color="#ffffff" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">{cat.name}</h1>
            <p className="text-sm text-white/80 mt-1">{cat.description}</p>
          </div>
        </div>
      </div>
      <div className="px-5 mt-5">
        <h2 className="font-bold text-ink-900 mb-3">Choose a service</h2>
        <div className="space-y-3">
          {services.map((s) => (
            <button key={s.id} onClick={() => go('booking', { serviceId: s.id })} className="w-full card p-4 flex items-center justify-between text-left active:scale-[0.98] transition">
              <div className="flex-1">
                <p className="font-bold text-ink-900">{s.name}</p>
                <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">{s.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm font-bold text-brand-700">From {inr(s.min_charge)}</span>
                  <span className="text-xs text-ink-400 flex items-center gap-1"><Clock size={12} /> {s.est_duration_min} min</span>
                </div>
              </div>
              <ChevronRight className="text-ink-300" size={18} />
            </button>
          ))}
          {services.length === 0 && <EmptyState icon={<Search size={28} />} title="No services yet" sub="Check back soon" />}
        </div>
      </div>
    </div>
  );
}
