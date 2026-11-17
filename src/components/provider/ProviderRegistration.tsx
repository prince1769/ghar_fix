import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast, Spinner, LoadingScreen } from '@/components/ui/Feedback';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { Logo } from '@/components/Logo';
import type { ServiceCategory, ProviderProfile } from '@/lib/types';
import { ArrowLeft, ArrowRight, Check, Upload, Clock, Wrench, BadgeCheck, Info } from 'lucide-react';

type Go = (view: string, params?: Record<string, string>) => void;

export function ProviderRegistration({ go }: { go: Go }) {
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [cats, setCats] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    bio: '',
    categoryIds: [] as string[],
    skills: [] as string[],
    experienceYears: 0,
    chargesVisiting: 199,
    chargesHourly: 250,
    serviceAreas: [] as string[],
    upiId: '',
    workingHours: {} as Record<string, { start: string; end: string }>,
    idDocUrl: '',
    certDocUrl: '',
  });

  useEffect(() => {
    supabase.from('service_categories').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => { setCats((data as ServiceCategory[]) ?? []); setLoading(false); });
  }, []);

  const toggleCat = (id: string) => setForm((f) => ({ ...f, categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter((x) => x !== id) : [...f.categoryIds, id] }));
  const toggleSkill = (s: string) => setForm((f) => ({ ...f, skills: f.skills.includes(s) ? f.skills.filter((x) => x !== s) : [...f.skills, s] }));
  const addArea = (v: string) => v && setForm((f) => ({ ...f, serviceAreas: [...f.serviceAreas, v] }));
  const [areaInput, setAreaInput] = useState('');
  const [skillInput, setSkillInput] = useState('');

  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const setHours = (day: string, field: 'start' | 'end', val: string) =>
    setForm((f) => ({ ...f, workingHours: { ...f.workingHours, [day]: { start: f.workingHours[day]?.start || '09:00', end: f.workingHours[day]?.end || '18:00', [field]: val } } }));

  const pickDoc = (field: 'idDocUrl' | 'certDocUrl') => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setForm((f) => ({ ...f, [field]: reader.result as string }));
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const submit = async () => {
    if (!profile) return;
    if (!form.full_name.trim()) { toast('Enter your name', 'error'); return; }
    if (form.categoryIds.length === 0) { toast('Select at least one category', 'error'); return; }
    if (form.serviceAreas.length === 0) { toast('Add at least one service area', 'error'); return; }
    if (!form.upiId.trim()) { toast('Enter UPI ID for payouts', 'error'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('provider_profiles').upsert({
      id: profile.id,
      full_name: form.full_name.trim(),
      phone: form.phone,
      email: form.email || null,
      bio: form.bio || null,
      category_ids: form.categoryIds,
      skills: form.skills,
      experience_years: form.experienceYears,
      charges_visiting: form.chargesVisiting,
      charges_hourly: form.chargesHourly,
      service_areas: form.serviceAreas,
      working_hours: form.workingHours,
      upi_id: form.upiId,
      identity_docs: { aadhaar: form.idDocUrl, certificate: form.certDocUrl },
      is_approved: false,
      approval_status: 'pending',
    });
    if (error) { toast(error.message, 'error'); setSubmitting(false); return; }
    // Insert doc rows
    if (form.idDocUrl) await supabase.from('provider_documents').insert({ provider_id: profile.id, doc_type: 'Aadhaar', file_url: form.idDocUrl });
    if (form.certDocUrl) await supabase.from('provider_documents').insert({ provider_id: profile.id, doc_type: 'Certificate', file_url: form.certDocUrl });
    await refreshProfile();
    toast('Application submitted! Admin will review shortly.', 'success');
    setSubmitting(false);
    go('dashboard');
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-ink-50 pb-32">
      <div className="bg-white px-5 py-4 sticky top-0 z-10 border-b border-ink-100 flex items-center gap-3">
        <button onClick={() => (step === 1 ? go('home') : setStep(step - 1))} className="p-2 -ml-2"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="font-bold text-ink-900">Provider registration</h1>
          <p className="text-xs text-ink-500">Step {step} of 4</p>
        </div>
      </div>
      <div className="px-5 pt-4">
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((n) => <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-brand-600' : 'bg-ink-200'}`} />)}
        </div>
      </div>

      <div className="px-5 mt-5">
        {/* Step 1: Basic info */}
        {step === 1 && (
          <div className="animate-slide-up space-y-4">
            <h2 className="font-bold text-ink-900">Basic details</h2>
            <div><label className="text-sm font-semibold text-ink-700 mb-1.5 block">Full name</label>
              <input className="input" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
            <div><label className="text-sm font-semibold text-ink-700 mb-1.5 block">Phone</label>
              <input className="input" value={form.phone} disabled /></div>
            <div><label className="text-sm font-semibold text-ink-700 mb-1.5 block">Email (optional)</label>
              <input className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div><label className="text-sm font-semibold text-ink-700 mb-1.5 block">Bio (optional)</label>
              <textarea className="input min-h-[72px] resize-none" placeholder="Tell customers about your expertise..." value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-semibold text-ink-700 mb-1.5 block">Experience (years)</label>
                <input type="number" min={0} className="input" value={form.experienceYears} onChange={(e) => setForm((f) => ({ ...f, experienceYears: +e.target.value }))} /></div>
              <div><label className="text-sm font-semibold text-ink-700 mb-1.5 block">Visiting charge (₹)</label>
                <input type="number" min={0} className="input" value={form.chargesVisiting} onChange={(e) => setForm((f) => ({ ...f, chargesVisiting: +e.target.value }))} /></div>
            </div>
            <button className="btn-primary w-full" onClick={() => setStep(2)}>Continue <ArrowRight size={18} /></button>
          </div>
        )}

        {/* Step 2: Skills & areas */}
        {step === 2 && (
          <div className="animate-slide-up space-y-4">
            <h2 className="font-bold text-ink-900">Skills & service areas</h2>
            <div>
              <label className="text-sm font-semibold text-ink-700 mb-2 block">Service categories</label>
              <div className="grid grid-cols-2 gap-2">
                {cats.map((c) => (
                  <button key={c.id} onClick={() => toggleCat(c.id)} className={`card p-3 flex items-center gap-2 text-left ${form.categoryIds.includes(c.id) ? 'border-brand-400 ring-2 ring-brand-200' : ''}`}>
                    <CategoryIcon name={c.icon_name} color={c.color} size={22} />
                    <span className="text-xs font-semibold text-ink-700 flex-1">{c.name}</span>
                    {form.categoryIds.includes(c.id) && <Check size={16} className="text-brand-600" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-700 mb-2 block">Skills</label>
              <div className="flex gap-2 mb-2">
                <input className="input flex-1" placeholder="e.g. Fan repair" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { toggleSkill(skillInput); setSkillInput(''); } }} />
                <button className="btn-ghost px-3" onClick={() => { toggleSkill(skillInput); setSkillInput(''); }}>Add</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.skills.map((s) => <span key={s} className="chip bg-brand-100 text-brand-700">{s} <button onClick={() => toggleSkill(s)}>×</button></span>)}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-700 mb-2 block">Service areas (localities)</label>
              <div className="flex gap-2 mb-2">
                <input className="input flex-1" placeholder="e.g. Indiranagar" value={areaInput} onChange={(e) => setAreaInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { addArea(areaInput); setAreaInput(''); } }} />
                <button className="btn-ghost px-3" onClick={() => { addArea(areaInput); setAreaInput(''); }}>Add</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.serviceAreas.map((s) => <span key={s} className="chip bg-accent-100 text-accent-700">{s} <button onClick={() => setForm((f) => ({ ...f, serviceAreas: f.serviceAreas.filter((x) => x !== s) }))}>×</button></span>)}
              </div>
            </div>
            <button className="btn-primary w-full" onClick={() => setStep(3)}>Continue <ArrowRight size={18} /></button>
          </div>
        )}

        {/* Step 3: Working hours & payout */}
        {step === 3 && (
          <div className="animate-slide-up space-y-4">
            <h2 className="font-bold text-ink-900">Working hours & payouts</h2>
            <div className="card p-4">
              <p className="text-sm font-semibold text-ink-700 mb-3">Weekly hours</p>
              <div className="space-y-2">
                {DAYS.map((d) => (
                  <div key={d} className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink-700 w-10 uppercase">{d}</span>
                    <input type="time" className="input flex-1 py-2" value={form.workingHours[d]?.start ?? '09:00'} onChange={(e) => setHours(d, 'start', e.target.value)} />
                    <span className="text-ink-400">-</span>
                    <input type="time" className="input flex-1 py-2" value={form.workingHours[d]?.end ?? '18:00'} onChange={(e) => setHours(d, 'end', e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
            <div><label className="text-sm font-semibold text-ink-700 mb-1.5 block">Hourly charge (₹)</label>
              <input type="number" min={0} className="input" value={form.chargesHourly} onChange={(e) => setForm((f) => ({ ...f, chargesHourly: +e.target.value }))} /></div>
            <div><label className="text-sm font-semibold text-ink-700 mb-1.5 block">UPI ID (for payouts)</label>
              <input className="input" placeholder="yourname@upi" value={form.upiId} onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))} /></div>
            <button className="btn-primary w-full" onClick={() => setStep(4)}>Continue <ArrowRight size={18} /></button>
          </div>
        )}

        {/* Step 4: Documents */}
        {step === 4 && (
          <div className="animate-slide-up space-y-4">
            <h2 className="font-bold text-ink-900">Identity documents</h2>
            <p className="text-sm text-ink-500 flex items-start gap-2"><Info size={16} className="shrink-0 mt-0.5" /> Your documents stay private and are only reviewed by the admin for verification.</p>
            <DocUpload label="Aadhaar / ID proof" url={form.idDocUrl} onPick={() => pickDoc('idDocUrl')} />
            <DocUpload label="Certificate (optional)" url={form.certDocUrl} onPick={() => pickDoc('certDocUrl')} />
            <button className="btn-primary w-full" onClick={submit} disabled={submitting}>
              {submitting ? <Spinner /> : <>Submit application <Check size={18} /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DocUpload({ label, url, onPick }: { label: string; url: string; onPick: () => void }) {
  return (
    <button onClick={onPick} className="card p-4 w-full text-left">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center">
          {url ? <BadgeCheck size={22} className="text-brand-600" /> : <Upload size={20} className="text-brand-600" />}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-ink-900 text-sm">{label}</p>
          <p className="text-xs text-ink-500">{url ? 'Uploaded' : 'Tap to upload'}</p>
        </div>
      </div>
      {url && <img src={url} alt="" className="mt-3 w-full h-32 object-cover rounded-xl" />}
    </button>
  );
}
