import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast, LoadingScreen, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { inr, formatDate, formatDateTime } from '@/lib/format';
import { statusLabel, statusChip } from '@/components/customer/CustomerHome';
import type {
  ProviderProfile, Booking, ServiceCategory, Service, Coupon, SupportTicket,
  PlatformSettings, Profile, Payment,
} from '@/lib/types';
import {
  Home, Users, Briefcase, Tag, LifeBuoy, Settings, LogOut, Check, X,
  Star, Plus, Trash2, Edit, Search, TrendingUp, IndianRupee, BarChart3,
  ChevronRight, Bell, ShieldCheck, Ban,
} from 'lucide-react';

type View =
  | 'dashboard' | 'providers' | 'categories' | 'services' | 'bookings'
  | 'coupons' | 'support' | 'settings';

export function AdminApp() {
  const { signOut } = useAuth();
  const [view, setView] = useState<View>('dashboard');

  const nav = [
    { key: 'dashboard', label: 'Dashboard', icon: Home },
    { key: 'providers', label: 'Providers', icon: Users },
    { key: 'categories', label: 'Categories', icon: Briefcase },
    { key: 'services', label: 'Services', icon: Tag },
    { key: 'bookings', label: 'Bookings', icon: Briefcase },
    { key: 'coupons', label: 'Coupons', icon: Tag },
    { key: 'support', label: 'Support', icon: LifeBuoy },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-ink-50 flex">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-ink-100 p-4 sticky top-0 h-screen">
        <div className="font-extrabold text-lg mb-6 px-2">Ghar<span className="text-accent-500">Fix</span> <span className="text-xs font-semibold text-ink-400">Admin</span></div>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => (
            <button key={n.key} onClick={() => setView(n.key as View)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold ${view === n.key ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50'}`}>
              <n.icon size={18} /> {n.label}
            </button>
          ))}
        </nav>
        <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut size={18} /> Sign out</button>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-ink-100 z-30 overflow-x-auto no-scrollbar">
        <div className="flex gap-1 px-2 py-2 min-w-max">
          {nav.map((n) => (
            <button key={n.key} onClick={() => setView(n.key as View)} className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl ${view === n.key ? 'text-brand-600' : 'text-ink-400'}`}>
              <n.icon size={18} />
              <span className="text-[10px] font-semibold">{n.label}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-5xl mx-auto w-full">
        {view === 'dashboard' && <AdminDashboard />}
        {view === 'providers' && <AdminProviders />}
        {view === 'categories' && <AdminCategories />}
        {view === 'services' && <AdminServices />}
        {view === 'bookings' && <AdminBookings />}
        {view === 'coupons' && <AdminCoupons />}
        {view === 'support' && <AdminSupport />}
        {view === 'settings' && <AdminSettings />}
      </main>
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState({ customers: 0, providers: 0, pending: 0, bookings: 0, revenue: 0, commission: 0 });
  const [recent, setRecent] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, p, pend, b, pay] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('provider_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('provider_profiles').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('payments').select('total, commission'),
      ]);
      const rev = (pay.data as Payment[] | null)?.reduce((s, p) => s + p.total, 0) ?? 0;
      const com = (pay.data as Payment[] | null)?.reduce((s, p) => s + p.commission, 0) ?? 0;
      setStats({
        customers: c.count ?? 0,
        providers: p.count ?? 0,
        pending: pend.count ?? 0,
        bookings: b.count ?? 0,
        revenue: rev,
        commission: com,
      });
      const { data: rb } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(5);
      setRecent((rb as Booking[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-ink-900">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Customers" value={String(stats.customers)} icon={Users} color="bg-brand-100 text-brand-700" />
        <StatCard label="Providers" value={String(stats.providers)} icon={Briefcase} color="bg-sky-100 text-sky-700" />
        <StatCard label="Pending approvals" value={String(stats.pending)} icon={ShieldCheck} color="bg-accent-100 text-accent-700" />
        <StatCard label="Total bookings" value={String(stats.bookings)} icon={BarChart3} color="bg-emerald-100 text-emerald-700" />
        <StatCard label="Revenue" value={inr(stats.revenue)} icon={IndianRupee} color="bg-violet-100 text-violet-700" />
        <StatCard label="Commission" value={inr(stats.commission)} icon={TrendingUp} color="bg-rose-100 text-rose-700" />
      </div>
      {stats.pending > 0 && (
        <div className="card p-4 bg-accent-50 border-accent-200">
          <p className="font-semibold text-accent-800">{stats.pending} provider(s) awaiting approval</p>
        </div>
      )}
      <div>
        <h2 className="font-bold text-ink-900 mb-3">Recent bookings</h2>
        <div className="space-y-2">
          {recent.map((b) => (
            <div key={b.id} className="card p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-ink-900">{formatDate(b.created_at)}</p>
                <p className="text-xs text-ink-500">{inr(b.pricing.total)}</p>
              </div>
              <span className={`chip ${statusChip(b.status)}`}>{statusLabel(b.status)}</span>
            </div>
          ))}
          {recent.length === 0 && <EmptyState icon={<BarChart3 size={28} />} title="No bookings yet" />}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Home; color: string }) {
  return (
    <div className="card p-4">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${color}`}><Icon size={20} /></div>
      <p className="text-2xl font-extrabold text-ink-900">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}

function AdminProviders() {
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'suspended'>('pending');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProviderProfile | null>(null);

  const load = useCallback(async () => {
    let q = supabase.from('provider_profiles').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('approval_status', filter);
    const { data } = await q;
    setProviders((data as ProviderProfile[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (p: ProviderProfile) => {
    await supabase.from('provider_profiles').update({ is_approved: true, approval_status: 'approved', rejected_reason: null }).eq('id', p.id);
    await supabase.from('notifications').insert({ user_id: p.id, type: 'approved', title: 'Application approved!', body: 'You are now visible to customers.' });
    toast('Provider approved', 'success');
    load();
    setSelected(null);
  };

  const reject = async (p: ProviderProfile, reason: string) => {
    await supabase.from('provider_profiles').update({ is_approved: false, approval_status: 'rejected', rejected_reason: reason }).eq('id', p.id);
    await supabase.from('notifications').insert({ user_id: p.id, type: 'rejected', title: 'Application rejected', body: reason });
    toast('Provider rejected', 'info');
    load();
    setSelected(null);
  };

  const suspend = async (p: ProviderProfile) => {
    await supabase.from('provider_profiles').update({ is_approved: false, approval_status: 'suspended' }).eq('id', p.id);
    toast('Provider suspended', 'info');
    load();
    setSelected(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-ink-900">Providers</h1>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(['pending', 'approved', 'rejected', 'suspended', 'all'] as const).map((f) => (
          <button key={f} onClick={() => { setFilter(f); setLoading(true); }} className={`chip ${filter === f ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>{f}</button>
        ))}
      </div>
      {loading ? <LoadingScreen /> : providers.length === 0 ? (
        <EmptyState icon={<Users size={28} />} title="No providers" />
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center font-bold text-brand-700">{p.full_name.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink-900 truncate">{p.full_name}</p>
                <p className="text-xs text-ink-500">{p.experience_years} yrs · {p.skills.length} skills</p>
              </div>
              <span className={`chip ${p.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : p.approval_status === 'pending' ? 'bg-accent-100 text-accent-700' : 'bg-rose-100 text-rose-700'}`}>{p.approval_status}</span>
              <button onClick={() => setSelected(p)} className="text-brand-600 text-sm font-semibold">View</button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title="Provider details"
          footer={
            <div className="flex gap-2">
              {selected.approval_status === 'pending' && (
                <>
                  <button className="btn-ghost flex-1 text-rose-600 border-rose-200" onClick={() => reject(selected, 'Documents incomplete')}>Reject</button>
                  <button className="btn-primary flex-1" onClick={() => approve(selected)}><Check size={18} /> Approve</button>
                </>
              )}
              {selected.approval_status === 'approved' && <button className="btn-ghost flex-1 text-rose-600 border-rose-200" onClick={() => suspend(selected)}><Ban size={16} /> Suspend</button>}
              {selected.approval_status === 'rejected' && <button className="btn-primary flex-1" onClick={() => approve(selected)}>Approve</button>}
              {selected.approval_status === 'suspended' && <button className="btn-primary flex-1" onClick={() => approve(selected)}>Reinstate</button>}
            </div>
          }>
          <div className="space-y-2 text-sm">
            <Field label="Name" value={selected.full_name} />
            <Field label="Phone" value={selected.phone ?? '-'} />
            <Field label="Experience" value={`${selected.experience_years} years`} />
            <Field label="Skills" value={selected.skills.join(', ') || '-'} />
            <Field label="Service areas" value={selected.service_areas.join(', ') || '-'} />
            <Field label="Visiting charge" value={inr(selected.charges_visiting)} />
            <Field label="UPI" value={selected.upi_id ?? '-'} />
            <Field label="Rating" value={`${selected.rating_avg.toFixed(1)} (${selected.rating_count})`} />
            <Field label="Jobs" value={String(selected.jobs_completed)} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><span className="text-ink-400">{label}: </span><span className="font-semibold text-ink-900">{value}</span></div>;
}

function AdminCategories() {
  const [cats, setCats] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', icon_name: 'Wrench', color: '#7c3aed', description: '', sort_order: 0 });

  const load = async () => {
    const { data } = await supabase.from('service_categories').select('*').order('sort_order');
    setCats((data as ServiceCategory[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim()) { toast('Name and slug required', 'error'); return; }
    if (editing) {
      await supabase.from('service_categories').update(form).eq('id', editing.id);
    } else {
      await supabase.from('service_categories').insert(form);
    }
    toast('Saved', 'success');
    setEditing(null); setCreating(false);
    setForm({ name: '', slug: '', icon_name: 'Wrench', color: '#7c3aed', description: '', sort_order: 0 });
    load();
  };

  const toggleActive = async (c: ServiceCategory) => {
    await supabase.from('service_categories').update({ is_active: !c.is_active }).eq('id', c.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink-900">Categories</h1>
        <button className="btn-primary" onClick={() => { setCreating(true); setForm({ name: '', slug: '', icon_name: 'Wrench', color: '#7c3aed', description: '', sort_order: cats.length + 1 }); }}><Plus size={18} /> Add</button>
      </div>
      {loading ? <LoadingScreen /> : (
        <div className="space-y-2">
          {cats.map((c) => (
            <div key={c.id} className="card p-3 flex items-center gap-3">
              <CategoryIcon name={c.icon_name} color={c.color} size={22} />
              <div className="flex-1">
                <p className="font-semibold text-ink-900">{c.name}</p>
                <p className="text-xs text-ink-500">{c.slug}</p>
              </div>
              <button onClick={() => toggleActive(c)} className={`chip ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>{c.is_active ? 'active' : 'off'}</button>
              <button onClick={() => { setEditing(c); setForm({ name: c.name, slug: c.slug, icon_name: c.icon_name, color: c.color, description: c.description ?? '', sort_order: c.sort_order }); }} className="text-brand-600"><Edit size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <Modal open={!!(editing || creating)} onClose={() => { setEditing(null); setCreating(false); }} title={editing ? 'Edit category' : 'New category'}
          footer={<button className="btn-primary w-full" onClick={save}>Save</button>}>
          <div className="space-y-3">
            <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className="input" placeholder="slug (e.g. ac-repair)" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} disabled={!!editing} />
            <input className="input" placeholder="Icon name (lucide)" value={form.icon_name} onChange={(e) => setForm((f) => ({ ...f, icon_name: e.target.value }))} />
            <div className="flex items-center gap-2"><label className="text-sm font-semibold text-ink-700">Color</label><input type="color" className="w-12 h-10 rounded-lg" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} /></div>
            <textarea className="input min-h-[60px] resize-none" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <input type="number" className="input" placeholder="Sort order" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: +e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminServices() {
  const [cats, setCats] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '', base_charge: 0, min_charge: 0, extra_charge_desc: '', est_duration_min: 60, sort_order: 0 });

  const load = async () => {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('service_categories').select('*').order('sort_order'),
      supabase.from('services').select('*').order('sort_order'),
    ]);
    setCats((c as ServiceCategory[]) ?? []);
    setServices((s as Service[]) ?? []);
    if (!selectedCat && c && c.length) setSelectedCat((c[0] as ServiceCategory).id);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = selectedCat ? services.filter((s) => s.category_id === selectedCat) : services;

  const save = async () => {
    if (!form.name.trim()) { toast('Name required', 'error'); return; }
    if (editing) {
      await supabase.from('services').update({ ...form }).eq('id', editing.id);
    } else {
      await supabase.from('services').insert({ ...form, category_id: selectedCat });
    }
    toast('Saved', 'success');
    setEditing(null); setCreating(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink-900">Services</h1>
        <button className="btn-primary" onClick={() => { setCreating(true); setForm({ name: '', slug: '', description: '', base_charge: 0, min_charge: 0, extra_charge_desc: '', est_duration_min: 60, sort_order: filtered.length + 1 }); }}><Plus size={18} /> Add</button>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {cats.map((c) => (
          <button key={c.id} onClick={() => setSelectedCat(c.id)} className={`chip ${selectedCat === c.id ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>{c.name}</button>
        ))}
      </div>
      {loading ? <LoadingScreen /> : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} className="card p-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold text-ink-900">{s.name}</p>
                <p className="text-xs text-ink-500">{inr(s.base_charge)} · {s.est_duration_min}min</p>
              </div>
              <span className={`chip ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>{s.is_active ? 'active' : 'off'}</span>
              <button onClick={() => { setEditing(s); setForm({ name: s.name, slug: s.slug, description: s.description ?? '', base_charge: s.base_charge, min_charge: s.min_charge, extra_charge_desc: s.extra_charge_desc ?? '', est_duration_min: s.est_duration_min, sort_order: s.sort_order }); }} className="text-brand-600"><Edit size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <Modal open={!!(editing || creating)} onClose={() => { setEditing(null); setCreating(false); }} title={editing ? 'Edit service' : 'New service'}
          footer={<button className="btn-primary w-full" onClick={save}>Save</button>}>
          <div className="space-y-3">
            <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <textarea className="input min-h-[60px] resize-none" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-ink-500">Base ₹</label><input type="number" className="input" value={form.base_charge} onChange={(e) => setForm((f) => ({ ...f, base_charge: +e.target.value }))} /></div>
              <div><label className="text-xs font-semibold text-ink-500">Min ₹</label><input type="number" className="input" value={form.min_charge} onChange={(e) => setForm((f) => ({ ...f, min_charge: +e.target.value }))} /></div>
            </div>
            <input className="input" placeholder="Extra charge desc" value={form.extra_charge_desc} onChange={(e) => setForm((f) => ({ ...f, extra_charge_desc: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-ink-500">Duration (min)</label><input type="number" className="input" value={form.est_duration_min} onChange={(e) => setForm((f) => ({ ...f, est_duration_min: +e.target.value }))} /></div>
              <div><label className="text-xs font-semibold text-ink-500">Sort</label><input type="number" className="input" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: +e.target.value }))} /></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Record<string, Service>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(100);
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
  }, []);

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const statuses = ['all', 'finding', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled'];

  const cancel = async (id: string) => {
    await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id);
    toast('Booking cancelled', 'info');
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'cancelled' } : b));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-ink-900">Bookings</h1>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {statuses.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`chip ${filter === s ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>{s === 'all' ? 'All' : statusLabel(s)}</button>
        ))}
      </div>
      {loading ? <LoadingScreen /> : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <div key={b.id} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink-900">{services[b.service_id]?.name ?? 'Service'}</p>
                <span className={`chip ${statusChip(b.status)}`}>{statusLabel(b.status)}</span>
              </div>
              <p className="text-xs text-ink-500 mt-1">{formatDateTime(b.created_at)} · {inr(b.pricing.total)}</p>
              {b.status !== 'cancelled' && b.status !== 'completed' && (
                <button onClick={() => cancel(b.id)} className="text-xs text-rose-600 font-semibold mt-2">Cancel booking</button>
              )}
            </div>
          ))}
          {filtered.length === 0 && <EmptyState icon={<Briefcase size={28} />} title="No bookings" />}
        </div>
      )}
    </div>
  );
}

function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', description: '', discount_type: 'flat' as 'flat' | 'percent', discount_value: 0, min_order: 0, max_discount: 0 });

  const load = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons((data as Coupon[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.code.trim()) { toast('Code required', 'error'); return; }
    await supabase.from('coupons').insert({ ...form, code: form.code.toUpperCase() });
    toast('Coupon created', 'success');
    setCreating(false);
    load();
  };

  const toggle = async (c: Coupon) => {
    await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink-900">Coupons</h1>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> Add</button>
      </div>
      {loading ? <LoadingScreen /> : (
        <div className="space-y-2">
          {coupons.map((c) => (
            <div key={c.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-ink-900">{c.code}</p>
                <p className="text-xs text-ink-500">{c.description}</p>
                <p className="text-xs text-ink-400 mt-1">{c.discount_type === 'flat' ? `${inr(c.discount_value)} off` : `${c.discount_value}% off`} · min {inr(c.min_order)}</p>
              </div>
              <button onClick={() => toggle(c)} className={`chip ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>{c.is_active ? 'active' : 'off'}</button>
            </div>
          ))}
        </div>
      )}
      {creating && (
        <Modal open={creating} onClose={() => setCreating(false)} title="New coupon"
          footer={<button className="btn-primary w-full" onClick={save}>Create</button>}>
          <div className="space-y-3">
            <input className="input uppercase" placeholder="CODE" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={() => setForm((f) => ({ ...f, discount_type: 'flat' }))} className={`chip ${form.discount_type === 'flat' ? 'bg-brand-600 text-white' : 'bg-ink-100'}`}>Flat</button>
              <button onClick={() => setForm((f) => ({ ...f, discount_type: 'percent' }))} className={`chip ${form.discount_type === 'percent' ? 'bg-brand-600 text-white' : 'bg-ink-100'}`}>Percent</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-xs">Value</label><input type="number" className="input" value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: +e.target.value }))} /></div>
              <div><label className="text-xs">Min order</label><input type="number" className="input" value={form.min_order} onChange={(e) => setForm((f) => ({ ...f, min_order: +e.target.value }))} /></div>
              <div><label className="text-xs">Max disc</label><input type="number" className="input" value={form.max_discount} onChange={(e) => setForm((f) => ({ ...f, max_discount: +e.target.value }))} /></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
    setTickets((data as SupportTicket[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const respond = async (t: SupportTicket, status: 'resolved' | 'closed') => {
    const r = reply[t.id]?.trim();
    if (!r) { toast('Write a reply', 'error'); return; }
    await supabase.from('support_tickets').update({ admin_reply: r, status }).eq('id', t.id);
    await supabase.from('notifications').insert({ user_id: t.user_id, type: 'support', title: 'Support update', body: r });
    toast('Reply sent', 'success');
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-ink-900">Support tickets</h1>
      {loading ? <LoadingScreen /> : tickets.length === 0 ? (
        <EmptyState icon={<LifeBuoy size={28} />} title="No tickets" />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-ink-900">{t.subject}</p>
                <span className={`chip ${t.status === 'open' ? 'bg-accent-100 text-accent-700' : 'bg-emerald-100 text-emerald-700'}`}>{t.status}</span>
              </div>
              <p className="text-sm text-ink-600">{t.message}</p>
              {t.admin_reply && <div className="bg-brand-50 rounded-xl p-3 text-sm text-ink-700"><b>Admin:</b> {t.admin_reply}</div>}
              {t.status === 'open' && (
                <div className="space-y-2">
                  <textarea className="input min-h-[60px] resize-none" placeholder="Reply..." value={reply[t.id] ?? ''} onChange={(e) => setReply((p) => ({ ...p, [t.id]: e.target.value }))} />
                  <div className="flex gap-2">
                    <button className="btn-ghost flex-1" onClick={() => respond(t, 'closed')}>Close</button>
                    <button className="btn-primary flex-1" onClick={() => respond(t, 'resolved')}>Resolve</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => setSettings((data as PlatformSettings) ?? null));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase.from('platform_settings').update({
      commission_pct: settings.commission_pct,
      platform_fee: settings.platform_fee,
      cancellation_charge: settings.cancellation_charge,
    }).eq('id', 1);
    toast('Settings saved', 'success');
    setSaving(false);
  };

  if (!settings) return <LoadingScreen />;

  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-extrabold text-ink-900">Platform settings</h1>
      <div className="card p-4 space-y-4">
        <div><label className="text-sm font-semibold text-ink-700 block mb-1.5">Commission (%)</label>
          <input type="number" className="input" value={settings.commission_pct} onChange={(e) => setSettings({ ...settings, commission_pct: +e.target.value })} /></div>
        <div><label className="text-sm font-semibold text-ink-700 block mb-1.5">Platform fee (₹)</label>
          <input type="number" className="input" value={settings.platform_fee} onChange={(e) => setSettings({ ...settings, platform_fee: +e.target.value })} /></div>
        <div><label className="text-sm font-semibold text-ink-700 block mb-1.5">Cancellation charge (₹)</label>
          <input type="number" className="input" value={settings.cancellation_charge} onChange={(e) => setSettings({ ...settings, cancellation_charge: +e.target.value })} /></div>
        <button className="btn-primary w-full" onClick={save} disabled={saving}>{saving ? <Spinner /> : 'Save settings'}</button>
      </div>
    </div>
  );
}
