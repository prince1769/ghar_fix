import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { LoadingScreen, EmptyState, toast, Spinner } from '@/components/ui/Feedback';
import { StarRating } from '@/components/ui/StarRating';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { inr, formatDateTime, timeAgo } from '@/lib/format';
import { statusLabel, statusChip } from './CustomerHome';
import type { Booking, Service, ServiceCategory, ProviderProfile, Address, StatusHistory, Review } from '@/lib/types';
import {
  ArrowLeft, Phone, MessageSquare, MapPin, Check, Clock, Star, Navigation,
  Search, XCircle,
} from 'lucide-react';

type Go = (view: string, params?: Record<string, string>) => void;

const TIMELINE: { key: string; label: string }[] = [
  { key: 'finding', label: 'Finding a professional' },
  { key: 'accepted', label: 'Booking accepted' },
  { key: 'on_the_way', label: 'Provider on the way' },
  { key: 'arrived', label: 'Provider arrived' },
  { key: 'in_progress', label: 'Service in progress' },
  { key: 'completed', label: 'Service completed' },
];

export function TrackingScreen({ bookingId, go }: { bookingId: string; go: Go }) {
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);

  // review form
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
      const bk = b as Booking | null;
      setBooking(bk);
      if (bk) {
        const [{ data: s }, { data: c }, { data: a }, { data: h }, { data: r }] = await Promise.all([
          supabase.from('services').select('*').eq('id', bk.service_id).maybeSingle(),
          supabase.from('service_categories').select('*').eq('id', bk.category_id).maybeSingle(),
          bk.address_id ? supabase.from('addresses').select('*').eq('id', bk.address_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
          supabase.from('booking_status_history').select('*').eq('booking_id', bookingId).order('created_at'),
          supabase.from('reviews').select('*').eq('booking_id', bookingId).maybeSingle(),
        ]);
        setService((s as Service) ?? null);
        setCategory((c as ServiceCategory) ?? null);
        setAddress((a as Address) ?? null);
        setHistory((h as StatusHistory[]) ?? []);
        setReview((r as Review) ?? null);
        if (bk.provider_id) {
          const { data: p } = await supabase.from('provider_profiles').select('*').eq('id', bk.provider_id).maybeSingle();
          setProvider((p as ProviderProfile) ?? null);
        }
      }
      setLoading(false);
    })();

    const sub = supabase
      .channel(`booking-${bookingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` }, async () => {
        const { data } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle();
        const bk = data as Booking | null;
        setBooking(bk);
        if (bk?.provider_id && !provider) {
          const { data: p } = await supabase.from('provider_profiles').select('*').eq('id', bk.provider_id).maybeSingle();
          setProvider((p as ProviderProfile) ?? null);
        }
        const { data: h } = await supabase.from('booking_status_history').select('*').eq('booking_id', bookingId).order('created_at');
        setHistory((h as StatusHistory[]) ?? []);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [bookingId, provider]);

  const cancelBooking = async () => {
    if (!booking || !profile) return;
    const { error } = await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', booking.id);
    if (error) { toast(error.message, 'error'); return; }
    await supabase.from('booking_status_history').insert({ booking_id: booking.id, status: 'cancelled', note: 'Cancelled by customer', actor_id: profile.id });
    toast('Booking cancelled', 'info');
  };

  const submitReview = async () => {
    if (!booking || !profile || !provider) return;
    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      booking_id: booking.id,
      customer_id: profile.id,
      provider_id: provider.id,
      rating,
      comment: comment.trim() || null,
    });
    if (error) { toast(error.message, 'error'); setSubmitting(false); return; }
    // Update provider rating
    const { data: ratings } = await supabase.from('reviews').select('rating').eq('provider_id', provider.id);
    if (ratings && ratings.length) {
      const avg = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
      await supabase.from('provider_profiles').update({ rating_avg: avg, rating_count: ratings.length }).eq('id', provider.id);
    }
    toast('Review submitted!', 'success');
    setSubmitting(false);
    go('home');
  };

  if (loading) return <LoadingScreen />;
  if (!booking) return <EmptyState icon={<XCircle size={28} />} title="Booking not found" />;

  const currentIndex = TIMELINE.findIndex((t) => t.key === booking.status);
  const isCompleted = booking.status === 'completed';
  const isCancelled = booking.status === 'cancelled';

  return (
    <div className="min-h-screen bg-ink-50 pb-32">
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-ink-100 flex items-center gap-3">
        <button onClick={() => go('home')} className="p-2 -ml-2"><ArrowLeft size={20} /></button>
        <h1 className="font-bold text-ink-900 flex-1">Booking tracking</h1>
        <span className={`chip ${statusChip(booking.status)}`}>{statusLabel(booking.status)}</span>
      </div>

      {/* Map placeholder */}
      <div className="h-44 bg-gradient-to-br from-brand-100 to-brand-50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, #cbd5e1 30px, #cbd5e1 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, #cbd5e1 30px, #cbd5e1 31px)' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/80 backdrop-blur rounded-2xl px-4 py-2 flex items-center gap-2 text-sm font-semibold text-ink-700">
            <Navigation size={16} className="text-brand-600" />
            {booking.status === 'finding' ? 'Locating nearby pros...' : booking.status === 'on_the_way' ? 'On the way to you' : 'Service location'}
          </div>
        </div>
      </div>

      <div className="px-5 mt-5 space-y-4">
        {/* Service summary */}
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

        {/* Provider card */}
        {provider ? (
          <div className="card p-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center font-bold text-brand-700 text-lg">
                {provider.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-bold text-ink-900">{provider.full_name}</p>
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <Star size={13} className="fill-accent-400 text-accent-400" />
                  <span className="font-bold text-ink-700">{provider.rating_avg.toFixed(1)}</span>
                  <span>· {provider.experience_years} yrs exp</span>
                </div>
              </div>
              <a href={`tel:${provider.phone ?? ''}`} className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <Phone size={18} className="text-emerald-600" />
              </a>
              <a href={`sms:${provider.phone ?? ''}`} className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center">
                <MessageSquare size={18} className="text-brand-600" />
              </a>
            </div>
          </div>
        ) : booking.status === 'finding' && (
          <div className="card p-6 text-center animate-pulse-soft">
            <Search className="mx-auto text-brand-500 mb-2 animate-spin" size={28} />
            <p className="font-semibold text-ink-700">Finding a professional near you...</p>
            <p className="text-xs text-ink-500 mt-1">This usually takes under a minute</p>
          </div>
        )}

        {/* Address */}
        {address && (
          <div className="card p-4 flex items-start gap-3">
            <MapPin size={18} className="text-brand-600 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-ink-900">{address.label}</p>
              <p className="text-xs text-ink-500">{address.line1}{address.landmark ? `, ${address.landmark}` : ''} - {address.pincode}</p>
            </div>
          </div>
        )}

        {/* Timeline */}
        {!isCancelled && (
          <div className="card p-5">
            <h3 className="font-bold text-ink-900 mb-4">Status timeline</h3>
            <div className="space-y-0">
              {TIMELINE.map((t, i) => {
                const done = i < currentIndex || isCompleted;
                const active = i === currentIndex && !isCompleted;
                const hist = history.find((h) => h.status === t.key);
                return (
                  <div key={t.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 text-white' : active ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-400'}`}>
                        {done ? <Check size={14} /> : active ? <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" /> : <div className="w-2 h-2 rounded-full bg-ink-300" />}
                      </div>
                      {i < TIMELINE.length - 1 && <div className={`w-0.5 flex-1 min-h-[24px] ${i < currentIndex ? 'bg-emerald-400' : 'bg-ink-200'}`} />}
                    </div>
                    <div className="pb-4">
                      <p className={`font-semibold text-sm ${done || active ? 'text-ink-900' : 'text-ink-400'}`}>{t.label}</p>
                      {hist && <p className="text-xs text-ink-400 flex items-center gap-1 mt-0.5"><Clock size={11} /> {timeAgo(hist.created_at)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="card p-6 text-center">
            <XCircle className="mx-auto text-rose-500 mb-2" size={28} />
            <p className="font-bold text-ink-900">Booking cancelled</p>
          </div>
        )}

        {/* Schedule info */}
        <div className="card p-4 flex items-center justify-between text-sm">
          <span className="text-ink-500">{booking.is_immediate ? 'Immediate booking' : 'Scheduled'}</span>
          <span className="font-semibold text-ink-700">{booking.is_immediate ? formatDateTime(booking.created_at) : booking.scheduled_at ? formatDateTime(booking.scheduled_at) : '-'}</span>
        </div>

        {/* Review / rebook for completed */}
        {isCompleted && (
          <div className="card p-5">
            <h3 className="font-bold text-ink-900 mb-3">{review ? 'Your review' : 'Rate your experience'}</h3>
            {review ? (
              <div>
                <StarRating value={review.rating} readOnly />
                {review.comment && <p className="text-sm text-ink-600 mt-2">{review.comment}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <StarRating value={rating} onChange={setRating} size={32} />
                <textarea className="input min-h-[72px] resize-none" placeholder="Share your experience (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
                <button className="btn-primary w-full" onClick={submitReview} disabled={submitting}>
                  {submitting ? <Spinner /> : 'Submit review'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cancel (while finding or accepted) */}
        {(booking.status === 'finding' || booking.status === 'accepted') && (
          <button className="btn-ghost w-full text-rose-600 border-rose-200 hover:bg-rose-50" onClick={cancelBooking}>
            Cancel booking
          </button>
        )}
      </div>
    </div>
  );
}
