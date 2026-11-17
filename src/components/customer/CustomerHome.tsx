import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { LoadingScreen, EmptyState } from '@/components/ui/Feedback';
import { inr, timeAgo } from '@/lib/format';
import type { ServiceCategory, Service, Booking, ProviderProfile } from '@/lib/types';
import { Search, MapPin, Bell, Star, ChevronRight, Clock, Tag, TrendingUp, Home as HomeIcon } from 'lucide-react';

type Nav = { tab: string; setTab: (t: string) => void };
type Go = (view: string, params?: Record<string, string>) => void;

export function CustomerHome({ go, nav }: { go: Go; nav: Nav }) {
  const { profile } = useAuth();
  const [cats, setCats] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [recent, setRecent] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: s }, { data: p }, { data: b }] = await Promise.all([
        supabase.from('service_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('services').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('provider_profiles').select('*').eq('is_approved', true).limit(6),
        profile
          ? supabase.from('bookings').select('*').eq('customer_id', profile.id).order('created_at', { ascending: false }).limit(3)
          : Promise.resolve({ data: [] as Booking[] | null, error: null }),
      ]);
      setCats((c as ServiceCategory[]) ?? []);
      setServices((s as Service[]) ?? []);
      setProviders((p as ProviderProfile[]) ?? []);
      setRecent((b as Booking[]) ?? []);
      setLoading(false);
    })();
  }, [profile]);

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const filteredServices = query
    ? services.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  if (loading) return <LoadingScreen />;

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white px-5 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-5">
          <Logo size="sm" light />
          <div className="flex items-center gap-3">
            <button onClick={() => nav.setTab('notifications')} className="relative p-2 rounded-full bg-white/15 backdrop-blur">
              <Bell size={18} />
            </button>
            <button onClick={() => nav.setTab('profile')} className="w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center font-bold text-sm">
              {(profile?.full_name || 'U').charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
        <p className="text-white/80 text-sm">{greet()},</p>
        <h1 className="text-xl font-extrabold mb-4">{profile?.full_name?.split(' ')[0] || 'there'}! What service do you need today?</h1>
        <button onClick={() => nav.setTab('addresses')} className="flex items-center gap-2 bg-white/15 backdrop-blur rounded-2xl px-3 py-2 mb-4 text-sm">
          <MapPin size={16} />
          <span className="truncate max-w-[200px]">Select location</span>
          <ChevronRight size={14} />
        </button>
        <div className="flex items-center gap-2 bg-white rounded-2xl px-4 py-3">
          <Search size={18} className="text-ink-400" />
          <input
            placeholder="Search for electricians, plumbers..."
            className="flex-1 bg-transparent outline-none text-ink-900 text-sm placeholder:text-ink-400"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Search results */}
      {query && filteredServices.length > 0 && (
        <div className="px-5 mt-4">
          <p className="text-sm font-semibold text-ink-500 mb-2">Services</p>
          <div className="space-y-2">
            {filteredServices.slice(0, 6).map((s) => (
              <button
                key={s.id}
                onClick={() => go('booking', { serviceId: s.id })}
                className="w-full card p-3 flex items-center justify-between text-left"
              >
                <div>
                  <p className="font-semibold text-ink-900">{s.name}</p>
                  <p className="text-xs text-ink-500">From {inr(s.min_charge)}</p>
                </div>
                <ChevronRight className="text-ink-300" size={18} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Promo banner */}
      <div className="px-5 mt-5">
        <div className="rounded-3xl bg-gradient-to-r from-accent-500 to-accent-600 text-white p-5 relative overflow-hidden">
          <div className="relative z-10">
            <span className="chip bg-white/20 text-white mb-2">LIMITED OFFER</span>
            <h3 className="text-lg font-extrabold">Flat ₹50 OFF</h3>
            <p className="text-sm text-white/90 mt-1">On your first booking. Use code GHAR50</p>
            <button onClick={() => go('categories')} className="mt-3 bg-white text-accent-600 font-bold rounded-xl px-4 py-2 text-sm">
              Book now
            </button>
          </div>
          <Tag className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10" />
        </div>
      </div>

      {/* Categories */}
      <div className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-ink-900">Popular services</h2>
          <button onClick={() => go('categories')} className="text-sm text-brand-600 font-semibold">See all</button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {cats.slice(0, 8).map((c) => (
            <button
              key={c.id}
              onClick={() => go('category', { id: c.id })}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-full aspect-square rounded-2xl bg-white shadow-soft border border-ink-100 flex items-center justify-center group-hover:shadow-card group-active:scale-95 transition">
                <CategoryIcon name={c.icon_name} color={c.color} size={24} />
              </div>
              <p className="text-[11px] font-semibold text-ink-700 text-center leading-tight">{c.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recommended providers */}
      {providers.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="font-bold text-ink-900 flex items-center gap-1.5">
              <TrendingUp size={18} className="text-accent-500" /> Top professionals
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-5 pb-2">
            {providers.map((p) => (
              <div key={p.id} className="card p-4 min-w-[180px] shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center font-bold text-brand-700 mb-3">
                  {p.full_name.charAt(0).toUpperCase()}
                </div>
                <p className="font-semibold text-ink-900 text-sm truncate">{p.full_name}</p>
                <p className="text-xs text-ink-500">{p.experience_years} yrs exp</p>
                <div className="flex items-center gap-1 mt-2">
                  <Star size={13} className="fill-accent-400 text-accent-400" />
                  <span className="text-xs font-bold text-ink-700">{p.rating_avg.toFixed(1)}</span>
                  <span className="text-xs text-ink-400">({p.rating_count})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent bookings */}
      <div className="px-5 mt-6">
        <h2 className="font-bold text-ink-900 mb-3">Recent bookings</h2>
        {recent.length === 0 ? (
          <EmptyState icon={<HomeIcon size={28} />} title="No bookings yet" sub="Book your first service in under a minute" />
        ) : (
          <div className="space-y-3">
            {recent.map((b) => (
              <button key={b.id} onClick={() => go('tracking', { id: b.id })} className="w-full card p-4 flex items-center justify-between text-left">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 truncate">{services.find((s) => s.id === b.service_id)?.name ?? 'Service'}</p>
                  <p className="text-xs text-ink-500 flex items-center gap-1 mt-0.5">
                    <Clock size={12} /> {timeAgo(b.created_at)}
                  </p>
                  <span className={`chip mt-2 ${statusChip(b.status)}`}>{statusLabel(b.status)}</span>
                </div>
                <ChevronRight className="text-ink-300" size={18} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function statusLabel(s: string) {
  const m: Record<string, string> = {
    finding: 'Finding', accepted: 'Accepted', on_the_way: 'On the way', arrived: 'Arrived',
    in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Rejected',
  };
  return m[s] ?? s;
}
export function statusChip(s: string) {
  const m: Record<string, string> = {
    finding: 'bg-accent-100 text-accent-700',
    accepted: 'bg-brand-100 text-brand-700',
    on_the_way: 'bg-sky-100 text-sky-700',
    arrived: 'bg-teal-100 text-teal-700',
    in_progress: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-rose-100 text-rose-700',
    rejected: 'bg-ink-100 text-ink-600',
  };
  return m[s] ?? 'bg-ink-100 text-ink-600';
}

export function useBookings(role: 'customer' | 'provider', userId: string) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const col = role === 'customer' ? 'customer_id' : 'provider_id';
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq(col, userId)
      .order('created_at', { ascending: false });
    setBookings((data as Booking[]) ?? []);
    setLoading(false);
  }, [role, userId]);

  useEffect(() => {
    load();
    const sub = supabase
      .channel(`bookings-${role}-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `${col}=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load, role, userId]);

  return { bookings, loading, reload: load };
}
