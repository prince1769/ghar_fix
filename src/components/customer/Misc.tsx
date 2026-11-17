import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast, LoadingScreen, EmptyState } from '@/components/ui/Feedback';
import { inr, formatDate } from '@/lib/format';
import { statusLabel, statusChip } from './CustomerHome';
import type { Address, Booking, Service, Notification, SupportTicket } from '@/lib/types';
import {
  ArrowLeft, Plus, MapPin, Home as HomeIcon, Briefcase, Star, Trash2,
  Bell, LifeBuoy, Send, ChevronRight, LogOut, User, Phone, Mail,
} from 'lucide-react';

type Go = (view: string, params?: Record<string, string>) => void;
type Nav = { tab: string; setTab: (t: string) => void };

export function AddressesScreen({ go }: { go: Go }) {
  const { profile } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: 'Home', line1: '', landmark: '', pincode: '', city: '' });

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase.from('addresses').select('*').eq('user_id', profile.id).order('created_at');
    setAddresses((data as Address[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const useGps = () => {
    if (!navigator.geolocation) { toast('GPS not available', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, line1: f.line1 || `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}` }));
        toast('Location captured', 'success');
      },
      () => toast('Could not get location', 'error')
    );
  };

  const save = async () => {
    if (!profile || !form.line1.trim() || !form.pincode.trim()) { toast('Fill address and PIN code', 'error'); return; }
    const { error } = await supabase.from('addresses').insert({ user_id: profile.id, ...form });
    if (error) { toast(error.message, 'error'); return; }
    toast('Address added', 'success');
    setForm({ label: 'Home', line1: '', landmark: '', pincode: '', city: '' });
    setAdding(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('addresses').delete().eq('id', id);
    load();
    toast('Address removed', 'info');
  };

  return (
    <div className="min-h-screen bg-ink-50 pb-24">
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-ink-100 flex items-center gap-3">
        <button onClick={() => go('home')} className="p-2 -ml-2"><ArrowLeft size={20} /></button>
        <h1 className="font-bold text-ink-900 flex-1">Saved addresses</h1>
        <button onClick={() => setAdding(true)} className="text-brand-600"><Plus size={22} /></button>
      </div>

      {loading ? <LoadingScreen /> : (
        <div className="px-5 mt-4 space-y-3">
          {addresses.length === 0 && !adding && <EmptyState icon={<MapPin size={28} />} title="No addresses" sub="Add your home or work address" />}
          {addresses.map((a) => (
            <div key={a.id} className="card p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center">
                {a.label.toLowerCase().includes('work') ? <Briefcase size={18} className="text-brand-600" /> : <HomeIcon size={18} className="text-brand-600" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-ink-900">{a.label}</p>
                <p className="text-sm text-ink-500">{a.line1}{a.landmark ? `, ${a.landmark}` : ''}</p>
                <p className="text-sm text-ink-500">{a.city} - {a.pincode}</p>
              </div>
              <button onClick={() => remove(a.id)} className="text-ink-400 hover:text-rose-500"><Trash2 size={16} /></button>
            </div>
          ))}

          {adding && (
            <div className="card p-4 space-y-3 animate-slide-up">
              <h3 className="font-bold text-ink-900">Add address</h3>
              <div className="flex gap-2">
                {['Home', 'Work', 'Other'].map((l) => (
                  <button key={l} onClick={() => setForm((f) => ({ ...f, label: l }))} className={`chip ${form.label === l ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>{l}</button>
                ))}
              </div>
              <input className="input" placeholder="Flat / House no, Building, Street" value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} />
              <input className="input" placeholder="Landmark (optional)" value={form.landmark} onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))} />
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="PIN code" maxLength={6} value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '') }))} />
                <input className="input flex-1" placeholder="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <button onClick={useGps} className="btn-ghost w-full"><MapPin size={16} /> Use GPS location</button>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => setAdding(false)}>Cancel</button>
                <button className="btn-primary flex-1" onClick={save}>Save</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BookingsList({ go }: { go: Go }) {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Record<string, Service>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from('bookings').select('*').eq('customer_id', profile.id).order('created_at', { ascending: false });
      const bs = (data as Booking[]) ?? [];
      setBookings(bs);
      if (bs.length) {
        const ids = [...new Set(bs.map((b) => b.service_id))];
        const { data: svcs } = await supabase.from('services').select('*').in('id', ids);
        const map: Record<string, Service> = {};
        (svcs as Service[] | null)?.forEach((s) => { map[s.id] = s; });
        setServices(map);
      }
      setLoading(false);
    })();
  }, [profile]);

  return (
    <div className="min-h-screen bg-ink-50 pb-24">
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-ink-100 flex items-center gap-3">
        <button onClick={() => go('home')} className="p-2 -ml-2"><ArrowLeft size={20} /></button>
        <h1 className="font-bold text-ink-900">My bookings</h1>
      </div>
      {loading ? <LoadingScreen /> : (
        <div className="px-5 mt-4 space-y-3">
          {bookings.length === 0 && <EmptyState icon={<Star size={28} />} title="No bookings yet" />}
          {bookings.map((b) => (
            <button key={b.id} onClick={() => go('tracking', { id: b.id })} className="w-full card p-4 text-left">
              <div className="flex items-center justify-between">
                <p className="font-bold text-ink-900">{services[b.service_id]?.name ?? 'Service'}</p>
                <span className={`chip ${statusChip(b.status)}`}>{statusLabel(b.status)}</span>
              </div>
              <p className="text-xs text-ink-500 mt-1">{formatDate(b.created_at)}</p>
              <p className="text-sm font-semibold text-brand-700 mt-2">{inr(b.pricing.total)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NotificationsScreen({ go }: { go: Go }) {
  const { profile } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50);
      setItems((data as Notification[]) ?? []);
      setLoading(false);
      // mark read
      const unread = (data as Notification[] | null)?.filter((n) => !n.is_read).map((n) => n.id) ?? [];
      if (unread.length) await supabase.from('notifications').update({ is_read: true }).in('id', unread);
    })();
  }, [profile]);

  return (
    <div className="min-h-screen bg-ink-50 pb-24">
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-ink-100 flex items-center gap-3">
        <button onClick={() => go('home')} className="p-2 -ml-2"><ArrowLeft size={20} /></button>
        <h1 className="font-bold text-ink-900">Notifications</h1>
      </div>
      {loading ? <LoadingScreen /> : (
        <div className="px-5 mt-4 space-y-2">
          {items.length === 0 && <EmptyState icon={<Bell size={28} />} title="No notifications" />}
          {items.map((n) => (
            <div key={n.id} className={`card p-4 ${n.is_read ? '' : 'border-brand-200'}`}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-brand-100 flex items-center justify-center shrink-0"><Bell size={16} className="text-brand-600" /></div>
                <div className="flex-1">
                  <p className="font-semibold text-ink-900 text-sm">{n.title}</p>
                  {n.body && <p className="text-xs text-ink-500 mt-0.5">{n.body}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SupportScreen({ go }: { go: Go }) {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase.from('support_tickets').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    setTickets((data as SupportTicket[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const submit = async () => {
    if (!profile || !subject.trim() || !message.trim()) { toast('Fill subject and message', 'error'); return; }
    const { error } = await supabase.from('support_tickets').insert({ user_id: profile.id, role: profile.role, subject: subject.trim(), message: message.trim() });
    if (error) { toast(error.message, 'error'); return; }
    toast('Support ticket submitted', 'success');
    setSubject(''); setMessage('');
    load();
  };

  return (
    <div className="min-h-screen bg-ink-50 pb-24">
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-ink-100 flex items-center gap-3">
        <button onClick={() => go('home')} className="p-2 -ml-2"><ArrowLeft size={20} /></button>
        <h1 className="font-bold text-ink-900">Help & support</h1>
      </div>
      <div className="px-5 mt-4 space-y-4">
        <div className="card p-4 space-y-3">
          <h3 className="font-bold text-ink-900 flex items-center gap-2"><LifeBuoy size={18} className="text-brand-600" /> Raise a ticket</h3>
          <input className="input" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="input min-h-[80px] resize-none" placeholder="Describe your issue..." value={message} onChange={(e) => setMessage(e.target.value)} />
          <button className="btn-primary w-full" onClick={submit}><Send size={16} /> Submit</button>
        </div>
        {!loading && tickets.length > 0 && (
          <div>
            <h3 className="font-bold text-ink-900 mb-2 px-1">Your tickets</h3>
            <div className="space-y-2">
              {tickets.map((t) => (
                <div key={t.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-ink-900">{t.subject}</p>
                    <span className={`chip ${t.status === 'open' ? 'bg-accent-100 text-accent-700' : 'bg-emerald-100 text-emerald-700'}`}>{t.status}</span>
                  </div>
                  <p className="text-xs text-ink-500 mt-1">{t.message}</p>
                  {t.admin_reply && <div className="mt-2 bg-brand-50 rounded-xl p-2 text-xs text-ink-700"><b>Admin:</b> {t.admin_reply}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfileScreen({ go, nav }: { go: Go; nav: Nav }) {
  const { profile, signOut } = useAuth();
  if (!profile) return null;
  const items = [
    { label: 'My bookings', icon: Star, view: 'bookings' },
    { label: 'Saved addresses', icon: MapPin, view: 'addresses' },
    { label: 'Notifications', icon: Bell, view: 'notifications' },
    { label: 'Help & support', icon: LifeBuoy, view: 'support' },
  ];
  return (
    <div className="min-h-screen bg-ink-50 pb-24">
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white px-5 pt-8 pb-10 rounded-b-3xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-white/20 flex items-center justify-center text-2xl font-extrabold">
            {profile.full_name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div>
            <h1 className="text-xl font-extrabold">{profile.full_name || 'User'}</h1>
            <p className="text-sm text-white/80 flex items-center gap-1 mt-0.5"><Phone size={13} /> {profile.phone}</p>
            {profile.email && <p className="text-sm text-white/80 flex items-center gap-1 mt-0.5"><Mail size={13} /> {profile.email}</p>}
          </div>
        </div>
      </div>
      <div className="px-5 mt-5">
        <div className="card overflow-hidden">
          {items.map((it, i) => (
            <button key={it.view} onClick={() => go(it.view)} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-ink-50 ${i > 0 ? 'border-t border-ink-100' : ''}`}>
              <it.icon size={18} className="text-brand-600" />
              <span className="font-semibold text-ink-700 flex-1">{it.label}</span>
              <ChevronRight size={18} className="text-ink-300" />
            </button>
          ))}
        </div>
        <button onClick={signOut} className="btn-ghost w-full mt-4 text-rose-600 border-rose-200 hover:bg-rose-50">
          <LogOut size={18} /> Sign out
        </button>
        <p className="text-center text-xs text-ink-400 mt-6">GharFix v1.0 · Made in India</p>
      </div>
    </div>
  );
}
