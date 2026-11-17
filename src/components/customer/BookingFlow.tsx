import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { LoadingScreen, Spinner, toast } from '@/components/ui/Feedback';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { inr } from '@/lib/format';
import type { Service, ServiceCategory, Address, PlatformSettings, Coupon } from '@/lib/types';
import {
  ArrowLeft, ArrowRight, Calendar, Clock, MapPin, Camera, Tag, Check,
  Zap, Home as HomeIcon, Briefcase, CreditCard, Wallet, Banknote, Star, Info,
} from 'lucide-react';

type Go = (view: string, params?: Record<string, string>) => void;

export function BookingFlow({ serviceId, go }: { serviceId: string; go: Go }) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [service, setService] = useState<Service | null>(null);
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // form
  const [isImmediate, setIsImmediate] = useState(true);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [addressId, setAddressId] = useState('');
  const [problem, setProblem] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi' | 'online'>('cod');
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const slots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: a }, { data: settings }] = await Promise.all([
        supabase.from('services').select('*, service_categories(*)').eq('id', serviceId).maybeSingle(),
        profile ? supabase.from('addresses').select('*').eq('user_id', profile.id).order('created_at') : Promise.resolve({ data: [] as Address[] | null, error: null }),
        supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
      ]);
      const svc = s as Service & { service_categories: ServiceCategory } | null;
      if (svc) {
        setService(svc);
        setCategory(svc.service_categories);
      }
      setAddresses((a as Address[]) ?? []);
      setSettings((settings as PlatformSettings) ?? null);
      setLoading(false);
    })();
  }, [serviceId, profile]);

  const base = service?.base_charge ?? 0;
  const additional = 0;
  const platformFee = settings?.platform_fee ?? 0;
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === 'flat') discount = appliedCoupon.discount_value;
    else discount = Math.min((base * appliedCoupon.discount_value) / 100, appliedCoupon.max_discount || Infinity);
    if (base < appliedCoupon.min_order) {
      discount = 0;
    }
  }
  const total = Math.max(0, base + additional + platformFee - discount);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    const { data } = await supabase.from('coupons').select('*').eq('code', couponCode.trim().toUpperCase()).maybeSingle();
    if (!data) { toast('Invalid coupon code', 'error'); return; }
    const c = data as Coupon;
    if (base < c.min_order) { toast(`Minimum order ${inr(c.min_order)} required`, 'error'); return; }
    setAppliedCoupon(c);
    toast('Coupon applied!', 'success');
  };

  const pickPhoto = () => {
    // Integration point: upload to Supabase Storage. For now, base64 data URL.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setPhotos((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const confirm = async () => {
    if (!profile || !service || !category) return;
    if (!addressId) { toast('Select an address', 'error'); return; }
    if (!isImmediate && (!date || !time)) { toast('Pick a date and time', 'error'); return; }
    setSubmitting(true);
    const scheduled = isImmediate ? null : new Date(`${date}T${time}:00`).toISOString();
    const pricing = { base, additional, platform_fee: platformFee, discount, total };
    const { data, error } = await supabase.from('bookings').insert({
      customer_id: profile.id,
      category_id: category.id,
      service_id: service.id,
      address_id: addressId,
      scheduled_at: scheduled,
      is_immediate: isImmediate,
      status: 'finding',
      problem_desc: problem,
      photos,
      coupon_code: appliedCoupon?.code ?? null,
      pricing,
      payment_method: paymentMethod,
    }).select('*').single();
    if (error) { toast(error.message, 'error'); setSubmitting(false); return; }
    const booking = data as { id: string };
    await supabase.from('booking_status_history').insert({ booking_id: booking.id, status: 'finding', note: 'Booking created', actor_id: profile.id });
    // Notify nearby providers (async, best-effort)
    setSubmitting(false);
    toast('Booking confirmed! Finding a professional...', 'success');
    go('tracking', { id: booking.id });
  };

  if (loading) return <LoadingScreen />;
  if (!service || !category) return <div className="p-6 text-center text-ink-500">Service not found</div>;

  return (
    <div className="min-h-screen bg-ink-50 pb-32">
      {/* Header */}
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-ink-100 flex items-center gap-3">
        <button onClick={() => (step === 1 ? go('home') : setStep(step - 1))} className="p-2 -ml-2"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="font-bold text-ink-900">{service.name}</h1>
          <p className="text-xs text-ink-500">Step {step} of 4</p>
        </div>
      </div>

      {/* Progress */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-brand-600' : 'bg-ink-200'}`} />
          ))}
        </div>
      </div>

      <div className="px-5 mt-5">
        {/* Step 1: Service summary */}
        {step === 1 && (
          <div className="animate-slide-up space-y-4">
            <div className="card p-4 flex items-center gap-4">
              <CategoryIcon name={category.icon_name} color={category.color} size={32} />
              <div className="flex-1">
                <p className="font-bold text-ink-900">{service.name}</p>
                <p className="text-sm text-ink-500">{category.name}</p>
              </div>
            </div>
            <div className="card p-4">
              <p className="text-sm text-ink-500 mb-1">{service.description}</p>
              <div className="flex items-center justify-between mt-3">
                <div>
                  <p className="text-xs text-ink-400">Base charge</p>
                  <p className="text-lg font-bold text-ink-900">{inr(service.base_charge)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-400">Duration</p>
                  <p className="text-sm font-semibold text-ink-700 flex items-center gap-1"><Clock size={14} /> {service.est_duration_min} min</p>
                </div>
              </div>
              {service.extra_charge_desc && (
                <p className="text-xs text-ink-400 mt-3 flex items-center gap-1"><Info size={12} /> {service.extra_charge_desc}</p>
              )}
            </div>
            <button className="btn-primary w-full" onClick={() => setStep(2)}>Continue <ArrowRight size={18} /></button>
          </div>
        )}

        {/* Step 2: Schedule */}
        {step === 2 && (
          <div className="animate-slide-up space-y-4">
            <h2 className="font-bold text-ink-900">When do you need it?</h2>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setIsImmediate(true)} className={`card p-4 text-center ${isImmediate ? 'border-brand-400 ring-2 ring-brand-200' : ''}`}>
                <Zap className="mx-auto text-accent-500 mb-2" size={24} />
                <p className="font-bold text-ink-900">Now</p>
                <p className="text-xs text-ink-500">Within 30-60 min</p>
              </button>
              <button onClick={() => setIsImmediate(false)} className={`card p-4 text-center ${!isImmediate ? 'border-brand-400 ring-2 ring-brand-200' : ''}`}>
                <Calendar className="mx-auto text-brand-600 mb-2" size={24} />
                <p className="font-bold text-ink-900">Schedule</p>
                <p className="text-xs text-ink-500">Pick date & time</p>
              </button>
            </div>
            {!isImmediate && (
              <div className="card p-4 space-y-4 animate-scale-in">
                <div>
                  <label className="text-sm font-semibold text-ink-700 mb-1.5 block">Date</label>
                  <input type="date" min={today} className="input" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-ink-700 mb-1.5 block">Time slot</label>
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((t) => (
                      <button key={t} onClick={() => setTime(t)} className={`rounded-xl py-2 text-sm font-semibold border ${time === t ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'}`}>{t}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <button className="btn-primary w-full" onClick={() => setStep(3)} disabled={!isImmediate && (!date || !time)}>Continue <ArrowRight size={18} /></button>
          </div>
        )}

        {/* Step 3: Address & details */}
        {step === 3 && (
          <div className="animate-slide-up space-y-4">
            <h2 className="font-bold text-ink-900">Address & details</h2>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-ink-700">Saved address</p>
                <button onClick={() => go('addresses')} className="text-sm text-brand-600 font-semibold">+ Add</button>
              </div>
              {addresses.length === 0 ? (
                <button onClick={() => go('addresses')} className="card p-4 w-full text-center text-sm text-ink-500">
                  <MapPin className="mx-auto mb-1 text-ink-400" size={20} /> Add an address to continue
                </button>
              ) : (
                <div className="space-y-2">
                  {addresses.map((a) => (
                    <button key={a.id} onClick={() => setAddressId(a.id)} className={`w-full card p-3 flex items-start gap-3 text-left ${addressId === a.id ? 'border-brand-400 ring-2 ring-brand-200' : ''}`}>
                      <HomeIcon size={18} className="text-brand-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-ink-900">{a.label}</p>
                        <p className="text-xs text-ink-500">{a.line1}{a.landmark ? `, ${a.landmark}` : ''} - {a.pincode}</p>
                      </div>
                      {addressId === a.id && <Check size={18} className="text-brand-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-700 mb-1.5 block">Describe the problem (optional)</label>
              <textarea className="input min-h-[80px] resize-none" placeholder="e.g. Ceiling fan not working, makes noise..." value={problem} onChange={(e) => setProblem(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-700 mb-1.5 block">Photos (optional)</label>
              <div className="flex gap-2 flex-wrap">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={p} alt="" className="w-20 h-20 rounded-2xl object-cover" />
                    <button onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center">×</button>
                  </div>
                ))}
                <button onClick={pickPhoto} className="w-20 h-20 rounded-2xl border-2 border-dashed border-ink-200 flex flex-col items-center justify-center text-ink-400 hover:border-brand-400 hover:text-brand-600">
                  <Camera size={20} />
                  <span className="text-[10px] mt-1">Add</span>
                </button>
              </div>
            </div>
            <button className="btn-primary w-full" onClick={() => setStep(4)} disabled={!addressId}>Continue <ArrowRight size={18} /></button>
          </div>
        )}

        {/* Step 4: Confirm & pay */}
        {step === 4 && (
          <div className="animate-slide-up space-y-4">
            <h2 className="font-bold text-ink-900">Review & confirm</h2>
            <div className="card p-4 space-y-2">
              <p className="text-xs font-semibold text-ink-400 uppercase">Price breakdown</p>
              <Row label="Base service charge" value={inr(base)} />
              <Row label="Additional charges" value={inr(additional)} />
              <Row label="Platform fee" value={inr(platformFee)} />
              {discount > 0 && <Row label="Discount" value={`-${inr(discount)}`} accent />}
              <div className="border-t border-ink-100 pt-2 flex justify-between">
                <span className="font-bold text-ink-900">Total payable</span>
                <span className="font-extrabold text-brand-700 text-lg">{inr(total)}</span>
              </div>
            </div>

            {/* Coupon */}
            <div className="card p-4">
              <p className="text-sm font-semibold text-ink-700 mb-2 flex items-center gap-1.5"><Tag size={15} /> Apply coupon</p>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-3 py-2">
                  <span className="text-sm font-bold text-emerald-700">{appliedCoupon.code} applied</span>
                  <button onClick={() => { setAppliedCoupon(null); setCouponCode(''); }} className="text-xs text-rose-500">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input className="input flex-1 uppercase" placeholder="GHAR50" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
                  <button className="btn-ghost px-4" onClick={applyCoupon}>Apply</button>
                </div>
              )}
            </div>

            {/* Payment method */}
            <div className="card p-4">
              <p className="text-sm font-semibold text-ink-700 mb-3">Payment method</p>
              <div className="space-y-2">
                {[
                  { key: 'cod', label: 'Cash on completion', icon: Banknote },
                  { key: 'upi', label: 'UPI', icon: Wallet },
                  { key: 'online', label: 'Online / Card', icon: CreditCard },
                ].map((m) => (
                  <button key={m.key} onClick={() => setPaymentMethod(m.key as 'cod' | 'upi' | 'online')} className={`w-full flex items-center gap-3 rounded-2xl p-3 border ${paymentMethod === m.key ? 'border-brand-400 bg-brand-50' : 'border-ink-200'}`}>
                    <m.icon size={18} className={paymentMethod === m.key ? 'text-brand-600' : 'text-ink-400'} />
                    <span className="font-semibold text-sm text-ink-900 flex-1 text-left">{m.label}</span>
                    {paymentMethod === m.key && <Check size={16} className="text-brand-600" />}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-primary w-full" onClick={confirm} disabled={submitting}>
              {submitting ? <Spinner /> : <>Confirm booking · {inr(total)}</>}
            </button>
            <p className="text-xs text-ink-400 text-center flex items-center justify-center gap-1">
              <Info size={12} /> You won't be charged until service completes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink-500">{label}</span>
      <span className={accent ? 'text-emerald-600 font-semibold' : 'text-ink-700 font-semibold'}>{value}</span>
    </div>
  );
}
