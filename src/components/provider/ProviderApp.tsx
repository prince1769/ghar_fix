import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast, LoadingScreen, EmptyState, Spinner } from '@/components/ui/Feedback';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { inr, formatDateTime, timeAgo, formatDate } from '@/lib/format';
import { statusLabel, statusChip } from '@/components/customer/CustomerHome';
import type { ProviderProfile, Booking, Service, ServiceCategory, Address, Profile, Payment } from '@/lib/types';
import {
  ArrowLeft, Home, Briefcase, Wallet, Bell, User, Check, X, Clock,
  MapPin, Phone, Navigation, TrendingUp, Star, LogOut, ChevronRight,
  Power, Camera,
} from 'lucide-react';
import { ProviderRegistration } from './ProviderRegistration';

type Go = (view: string, params?: Record<string, string>) => void;

export function ProviderApp() {
  const { profile } = useAuth();
  const [view, setView] = useState('dashboard');
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const go = (v: string, params: Record<string, string> = {}) => {
    setView(Object.keys(params).length ? `${v}:${Object.values(params).join(',')}` : v);
    window.scrollTo(0, 0);
  };

  const loadProvider = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('provider_profiles').select('*').eq('id', profile.id).maybeSingle();
    setProvider((data as ProviderProfile) ?? null);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadProvider(); }, [loadProvider]);

  if (loading) return <div className="max-w-md mx-auto"><LoadingScreen /></div>;
  if (!provider) return <ProviderRegistration go={(v) => setView(v)} />;

  const tab = view.split(':')[0];
  const jobId = view.includes(':') ? view.split(':')[1] : null;

  return (
    <div className="max-w-md mx-auto bg-ink-50 min-h-screen pb-24">
      {tab === 'dashboard' && <ProviderDashboard provider={provider} go={go} reload={loadProvider} />}
      {tab === 'jobs' && <ProviderJobs provider={provider} go={go} />}
      {tab === 'job' && jobId && <ProviderJobDetail jobId={jobId} provider={provider} go={go} reload={loadProvider} />}
      {tab === 'earnings' && <ProviderEarnings provider={provider} go={go} />}
      {tab === 'profile' && <ProviderProfileView provider={provider} go={go} />}

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-ink-100 px-2 py-2 flex items-center justify-around z-30">
        {[
          { key: 'dashboard', label: 'Home', icon: Home },
          { key: 'jobs', label: 'Jobs', icon: Briefcase },
          { key: 'earnings', label: 'Earnings', icon: Wallet },
          { key: 'profile', label: 'Profile', icon: User },
        ].map((t) => (
          <button key={t.key} onClick={() => go(t.key)} className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl ${tab === t.key ? 'text-brand-600' : 'text-ink-400'}`}>
            <t.icon size={20} strokeWidth={tab === t.key ? 2.5 : 2} />
            <span className="text-[11px] font-semibold">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProviderDashboard({ provider, go, reload }: { provider: ProviderProfile; go: Go; reload: () => Promise<void> }) {
  const [newJobs, setNewJobs] = useState<Booking[]>([]);
  const [activeJobs, setActiveJobs] = useState<Booking[]>([]);
  const [services, setServices] = useState<Record<string, Service>>({});

  const load = useCallback(async () => {
    const [act, nw] = await Promise.all([
      supabase.from('bookings').select('*').eq('provider_id', provider.id).in('status', ['accepted', 'on_the_way', 'arrived', 'in_progress']).order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').eq('status', 'finding').order('created_at', { ascending: false }).limit(10),
    ]);
    setActiveJobs((act.data as Booking[]) ?? []);
    setNewJobs((nw.data as Booking[]) ?? []);
    const ids = [...new Set([...(act.data ?? []), ...(nw.data ?? [])].map((b) => (b as Booking).service_id))];
    if (ids.length) {
      const { data: svcs } = await supabase.from('services').select('*').in('id', ids);
      const map: Record<string, Service> = {};
      (svcs as Service[] | null)?.forEach((s) => { map[s.id] = s; });
      setServices(map);
    }
  }, [provider.id]);

  useEffect(() => {
    load();
    const sub = supabase.channel(`prov-dash-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load, provider.id]);

  const toggleAvailable = async () => {
    await supabase.from('provider_profiles').update({ is_available: !provider.is_available }).eq('id', provider.id);
    reload();
  };

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white px-5 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/80 text-sm">Welcome back,</p>
            <h1 className="text-xl font-extrabold">{provider.full_name.split(' ')[0]}</h1>
          </div>
          <button onClick={toggleAvailable} className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${provider.is_available ? 'bg-emerald-400 text-emerald-950' : 'bg-white/15 text-white'}`}>
            <Power size={16} /> {provider.is_available ? 'Online' : 'Offline'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Today" value={inr(provider.total_earnings)} small />
          <Stat label="Jobs" value={String(provider.jobs_completed)} />
          <Stat label="Rating" value={provider.rating_avg.toFixed(1)} />
        </div>
      </div>

      {provider.approval_status === 'pending' && (
        <div className="mx-5 mt-4 rounded-2xl bg-accent-50 border border-accent-200 p-4 flex items-center gap-3">
          <Clock className="text-accent-600 shrink-0" size={20} />
          <p className="text-sm text-accent-800">Your application is under review. You'll be visible to customers once approved.</p>
        </div>
      )}
      {provider.approval_status === 'rejected' && (
        <div className="mx-5 mt-4 rounded-2xl bg-rose-50 border border-rose-200 p-4">
          <p className="text-sm text-rose-800 font-semibold">Application rejected</p>
          {provider.rejected_reason && <p className="text-xs text-rose-600 mt-1">{provider.rejected_reason}</p>}
        </div>
      )}

      <div className="px-5 mt-5">
        <h2 className="font-bold text-ink-900 mb-3">Active jobs</h2>
        {activeJobs.length === 0 ? (
          <EmptyState icon={<Briefcase size={28} />} title="No active jobs" sub="New requests will appear here" />
        ) : (
          <div className="space-y-3">
            {activeJobs.map((b) => (
              <button key={b.id} onClick={() => go('job', { id: b.id })} className="w-full card p-4 text-left">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-ink-900">{services[b.service_id]?.name ?? 'Service'}</p>
                  <span className={`chip ${statusChip(b.status)}`}>{statusLabel(b.status)}</span>
                </div>
                <p className="text-xs text-ink-500 mt-1">{timeAgo(b.created_at)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {provider.is_approved && newJobs.length > 0 && (
        <div className="px-5 mt-5">
          <h2 className="font-bold text-ink-900 mb-3 flex items-center gap-1.5">
            <TrendingUp size={18} className="text-accent-500" /> Nearby requests
          </h2>
          <div className="space-y-3">
            {newJobs.map((b) => (
              <button key={b.id} onClick={() => go('job', { id: b.id })} className="w-full card p-4 text-left border-accent-200">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-ink-900">{services[b.service_id]?.name ?? 'Service'}</p>
                  <span className="chip bg-accent-100 text-accent-700">New</span>
                </div>
                <p className="text-xs text-ink-500 mt-1">{b.is_immediate ? 'Immediate' : formatDateTime(b.scheduled_at)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-2xl px-3 py-2.5 text-center">
      <p className={`font-extrabold ${small ? 'text-sm' : 'text-lg'}`}>{value}</p>
      <p className="text-[10px] text-white/70">{label}</p>
    </div>
  );
}

function ProviderJobs({ provider, go }: { provider: ProviderProfile; go: Go }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Record<string, Service>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('bookings').select('*').eq('provider_id', provider.id).order('created_at', { ascending: false });
      const bs = (data as Booking[]) ?? [];
      setBookings(bs);
      if (bs.length) {
        const { data: svcs } = await supabase.from('services').select('*').in('id', [...new Set(bs.map((b) => b.service_id))]);
        const map: Record<string, Service> = {};
        (svcs as Service[] | null)?.forEach((s) => { map[s.id] = s; });
        setServices(map);
      }
      setLoading(false);
    })();
  }, [provider.id]);

  return (
    <div className="pb-24">
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-ink-100">
        <h1 className="font-bold text-ink-900">My jobs</h1>
      </div>
      {loading ? <LoadingScreen /> : (
        <div className="px-5 mt-4 space-y-3">
          {bookings.length === 0 && <EmptyState icon={<Briefcase size={28} />} title="No jobs yet" />}
          {bookings.map((b) => (
            <button key={b.id} onClick={() => go('job', { id: b.id })} className="w-full card p-4 text-left">
              <div className="flex items-center justify-between">
                <p className="font-bold text-ink-900">{services[b.service_id]?.name ?? 'Service'}</p>
                <span className={`chip ${statusChip(b.status)}`}>{statusLabel(b.status)}</span>
              </div>
              <p className="text-xs text-ink-500 mt-1">{formatDate(b.created_at)} · {inr(b.pricing.total)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderJobDetail({ jobId, provider, go, reload }: { jobId: string; provider: ProviderProfile; go: Go; reload: () => Promise<void> }) {
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from('bookings').select('*').eq('id', jobId).maybeSingle();
      const bk = b as Booking | null;
      setBooking(bk);
      if (bk) {
        const [{ data: s }, { data: c }, { data: cust }, { data: a }] = await Promise.all([
          supabase.from('services').select('*').eq('id', bk.service_id).maybeSingle(),
          supabase.from('service_categories').select('*').eq('id', bk.category_id).maybeSingle(),
          supabase.from('profiles').select('*').eq('id', bk.customer_id).maybeSingle(),
          bk.address_id ? supabase.from('addresses').select('*').eq('id', bk.address_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        ]);
        setService((s as Service) ?? null);
        setCategory((c as ServiceCategory) ?? null);
        setCustomer((cust as Profile) ?? null);
        setAddress((a as Address) ?? null);
      }
      setLoading(false);
    })();
    const sub = supabase.channel(`job-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${jobId}` }, async () => {
        const { data } = await supabase.from('bookings').select('*').eq('id', jobId).maybeSingle();
        setBooking((data as Booking) ?? null);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [jobId]);

  const accept = async () => {
    const { data, error } = await supabase.rpc('accept_booking', { p_booking_id: jobId });
    if (error) { toast(error.message, 'error'); return; }
    if (data && data.ok) { toast('Job accepted!', 'success'); }
    else if (data) { toast(data.error || 'Could not accept', 'error'); }
  };

  const reject = async () => {
    await supabase.from('booking_status_history').insert({ booking_id: jobId, status: 'rejected', note: 'Provider declined', actor_id: profile?.id });
    toast('Job declined', 'info');
    go('dashboard');
  };

  const updateStatus = async (status: Booking['status']) => {
    if (!booking) return;
    const fields: Record<string, unknown> = { status };
    if (status === 'arrived') fields.arrived_at = new Date().toISOString();
    if (status === 'in_progress') fields.started_at = new Date().toISOString();
    if (status === 'completed') fields.completed_at = new Date().toISOString();
    const { error } = await supabase.from('bookings').update(fields).eq('id', booking.id);
    if (error) { toast(error.message, 'error'); return; }
    await supabase.from('booking_status_history').insert({ booking_id: booking.id, status, note: `Status: ${statusLabel(status)}`, actor_id: profile?.id });
    // Notify customer
    await supabase.from('notifications').insert({ user_id: booking.customer_id, type: `booking_${status}`, title: statusLabel(status), body: `Your booking is now: ${statusLabel(status)}`, data: { booking_id: booking.id } });
    if (status === 'completed') {
      // Create payment record
      await supabase.from('payments').insert({
        booking_id: booking.id,
        method: booking.payment_method,
        base_charge: booking.pricing.base,
        additional_charge: booking.pricing.additional,
        platform_fee: booking.pricing.platform_fee,
        discount: booking.pricing.discount,
        commission: booking.pricing.base * 0.15,
        provider_payout: booking.pricing.base * 0.85,
        total: booking.pricing.total,
        status: booking.payment_method === 'cod' ? 'pending' : 'paid',
      });
      await supabase.from('provider_profiles').update({ jobs_completed: provider.jobs_completed + 1, total_earnings: provider.total_earnings + booking.pricing.base * 0.85 }).eq('id', provider.id);
      reload();
    }
    toast('Status updated', 'success');
  };

  const pickPhoto = (set: (p: string[]) => void, arr: string[]) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => set([...arr, reader.result as string]);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  if (loading) return <LoadingScreen />;
  if (!booking) return <EmptyState icon={<X size={28} />} title="Job not found" />;

  const isAssigned = booking.provider_id === provider.id;
  const isFinding = booking.status === 'finding';

  return (
    <div className="pb-24">
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-ink-100 flex items-center gap-3">
        <button onClick={() => go('dashboard')} className="p-2 -ml-2"><ArrowLeft size={20} /></button>
        <h1 className="font-bold text-ink-900 flex-1">Job details</h1>
        <span className={`chip ${statusChip(booking.status)}`}>{statusLabel(booking.status)}</span>
      </div>

      <div className="px-5 mt-4 space-y-4">
        {service && category && (
          <div className="card p-4 flex items-center gap-3">
            <CategoryIcon name={category.icon_name} color={category.color} size={28} />
            <div className="flex-1">
              <p className="font-bold text-ink-900">{service.name}</p>
              <p className="text-xs text-ink-500">{category.name}</p>
            </div>
            <p className="font-bold text-brand-700">{inr(booking.pricing.total)}</p>
          </div>
        )}

        {customer && (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center font-bold text-brand-700">{customer.full_name?.charAt(0).toUpperCase() ?? 'C'}</div>
            <div className="flex-1">
              <p className="font-semibold text-ink-900">{customer.full_name || 'Customer'}</p>
              <p className="text-xs text-ink-500">{customer.phone}</p>
            </div>
            <a href={`tel:${customer.phone ?? ''}`} className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center"><Phone size={18} className="text-emerald-600" /></a>
          </div>
        )}

        {address && (
          <div className="card p-4 flex items-start gap-3">
            <MapPin size={18} className="text-brand-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm text-ink-900">{address.label}</p>
              <p className="text-xs text-ink-500">{address.line1}{address.landmark ? `, ${address.landmark}` : ''} - {address.pincode}</p>
            </div>
          </div>
        )}

        {booking.problem_desc && (
          <div className="card p-4">
            <p className="text-xs font-semibold text-ink-400 uppercase mb-1">Problem</p>
            <p className="text-sm text-ink-700">{booking.problem_desc}</p>
          </div>
        )}

        {booking.photos.length > 0 && (
          <div className="card p-4">
            <p className="text-xs font-semibold text-ink-400 uppercase mb-2">Customer photos</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {booking.photos.map((p, i) => <img key={i} src={p} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />)}
            </div>
          </div>
        )}

        {/* Accept/Reject for finding */}
        {isFinding && !isAssigned && (
          <div className="flex gap-3">
            <button className="btn-ghost flex-1 text-rose-600 border-rose-200" onClick={reject}><X size={18} /> Decline</button>
            <button className="btn-primary flex-1" onClick={accept}><Check size={18} /> Accept</button>
          </div>
        )}

        {/* Status actions for assigned */}
        {isAssigned && booking.status !== 'completed' && booking.status !== 'cancelled' && (
          <div className="space-y-3">
            {booking.status === 'accepted' && <button className="btn-primary w-full" onClick={() => updateStatus('on_the_way')}><Navigation size={18} /> Mark on the way</button>}
            {booking.status === 'on_the_way' && <button className="btn-primary w-full" onClick={() => updateStatus('arrived')}><MapPin size={18} /> Mark arrived</button>}
            {booking.status === 'arrived' && <button className="btn-primary w-full" onClick={() => updateStatus('in_progress')}><Power size={18} /> Start work</button>}
            {booking.status === 'in_progress' && <button className="btn-accent w-full" onClick={() => updateStatus('completed')}><Check size={18} /> Mark completed</button>}
          </div>
        )}

        {/* Before/after photos */}
        {isAssigned && (booking.status === 'in_progress' || booking.status === 'completed') && (
          <div className="card p-4 space-y-3">
            <PhotoSection title="Before photos" photos={beforePhotos} onAdd={() => pickPhoto(setBeforePhotos, beforePhotos)} />
            <PhotoSection title="After photos" photos={afterPhotos} onAdd={() => pickPhoto(setAfterPhotos, afterPhotos)} />
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoSection({ title, photos, onAdd }: { title: string; photos: string[]; onAdd: () => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink-400 uppercase mb-2">{title}</p>
      <div className="flex gap-2 flex-wrap">
        {photos.map((p, i) => <img key={i} src={p} alt="" className="w-20 h-20 rounded-xl object-cover" />)}
        <button onClick={onAdd} className="w-20 h-20 rounded-xl border-2 border-dashed border-ink-200 flex items-center justify-center text-ink-400"><Camera size={20} /></button>
      </div>
    </div>
  );
}

function ProviderEarnings({ provider, go }: { provider: ProviderProfile; go: Go }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: bookings } = await supabase.from('bookings').select('id').eq('provider_id', provider.id);
      const ids = (bookings ?? []).map((b) => (b as { id: string }).id);
      if (ids.length) {
        const { data } = await supabase.from('payments').select('*').in('booking_id', ids).order('created_at', { ascending: false });
        setPayments((data as Payment[]) ?? []);
      }
      setLoading(false);
    })();
  }, [provider.id]);

  const commission = payments.reduce((s, p) => s + p.commission, 0);
  const net = payments.reduce((s, p) => s + p.provider_payout, 0);

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white px-5 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-xl font-extrabold mb-4">Earnings</h1>
        <div className="bg-white/15 backdrop-blur rounded-3xl p-5">
          <p className="text-white/70 text-sm">Total earnings</p>
          <p className="text-3xl font-extrabold">{inr(provider.total_earnings)}</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div><p className="text-xs text-white/70">Jobs done</p><p className="font-bold">{provider.jobs_completed}</p></div>
            <div><p className="text-xs text-white/70">Commission</p><p className="font-bold">{inr(commission)}</p></div>
          </div>
        </div>
      </div>
      <div className="px-5 mt-5">
        <h2 className="font-bold text-ink-900 mb-3">Payout history</h2>
        {loading ? <LoadingScreen /> : payments.length === 0 ? (
          <EmptyState icon={<Wallet size={28} />} title="No payouts yet" sub="Complete jobs to earn" />
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink-900 text-sm">{inr(p.provider_payout)}</p>
                  <p className="text-xs text-ink-500">{formatDate(p.created_at)}</p>
                </div>
                <span className={`chip ${p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-accent-100 text-accent-700'}`}>{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderProfileView({ provider, go }: { provider: ProviderProfile; go: Go }) {
  const { signOut } = useAuth();
  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white px-5 pt-8 pb-10 rounded-b-3xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-white/20 flex items-center justify-center text-2xl font-extrabold">{provider.full_name.charAt(0).toUpperCase()}</div>
          <div>
            <h1 className="text-xl font-extrabold">{provider.full_name}</h1>
            <p className="text-sm text-white/80">{provider.phone}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`chip ${provider.approval_status === 'approved' ? 'bg-emerald-400 text-emerald-950' : 'bg-white/20 text-white'}`}>{provider.approval_status}</span>
              <span className="text-xs text-white/80 flex items-center gap-1"><Star size={12} className="fill-accent-400 text-accent-400" /> {provider.rating_avg.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-5 mt-5 space-y-3">
        <InfoCard label="Skills" value={provider.skills.join(', ') || '-'} />
        <InfoCard label="Service areas" value={provider.service_areas.join(', ') || '-'} />
        <InfoCard label="Experience" value={`${provider.experience_years} years`} />
        <InfoCard label="Visiting charge" value={inr(provider.charges_visiting)} />
        <InfoCard label="UPI ID" value={provider.upi_id || '-'} />
        <button onClick={() => go('register')} className="btn-ghost w-full">Edit profile</button>
        <button onClick={signOut} className="btn-ghost w-full text-rose-600 border-rose-200 hover:bg-rose-50"><LogOut size={18} /> Sign out</button>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-ink-400 uppercase">{label}</p>
      <p className="text-sm text-ink-900 font-semibold mt-0.5">{value}</p>
    </div>
  );
}
