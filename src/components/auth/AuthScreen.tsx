import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Logo';
import { Spinner } from '@/components/ui/Feedback';
import { toast } from '@/components/ui/Feedback';
import type { Role } from '@/lib/types';
import { ArrowRight, Phone, ShieldCheck, User, Wrench, LayoutDashboard } from 'lucide-react';

// Demo OTP flow: real SMS OTP integration point marked below.
// Uses Supabase email/password under the hood with a synthetic email per phone.
// To switch to real OTP, replace sendOtp/verifyOtp with supabase.auth.signInWithOtp({ phone }).
const phoneToEmail = (phone: string) => `+${phone.replace(/\D/g, '')}@gharfix.demo`;

const ROLES: { key: Role; label: string; icon: typeof User; desc: string }[] = [
  { key: 'customer', label: 'Customer', icon: User, desc: 'Book home services' },
  { key: 'provider', label: 'Provider', icon: Wrench, desc: 'Offer your services' },
  { key: 'admin', label: 'Admin', icon: LayoutDashboard, desc: 'Manage platform' },
];

export function AuthScreen() {
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState<'role' | 'phone' | 'otp' | 'name'>('role');
  const [role, setRole] = useState<Role>('customer');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sentOtp, setSentOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const validPhone = (p: string) => /^[6-9]\d{9}$/.test(p.replace(/\D/g, '').slice(-10));
  const fullPhone = '+91' + phone.replace(/\D/g, '').slice(-10);

  const sendOtp = async () => {
    if (!validPhone(phone)) {
      toast('Enter a valid 10-digit Indian mobile number', 'error');
      return;
    }
    setLoading(true);
    // Integration point: replace with real SMS OTP provider.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSentOtp(code);
    setStep('otp');
    setLoading(false);
    toast(`Demo OTP: ${code}`, 'info');
  };

  const verifyOtp = async () => {
    if (otp !== sentOtp) {
      toast('Incorrect OTP. Try again.', 'error');
      return;
    }
    setLoading(true);
    const synthEmail = phoneToEmail(fullPhone);
    // Try sign in first; if no account, sign up.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: synthEmail,
      password: `Gh@rFix_${fullPhone}`,
    });
    if (signInErr) {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: synthEmail,
        password: `Gh@rFix_${fullPhone}`,
        options: { data: { phone: fullPhone, role } },
      });
      if (signUpErr) {
        toast(signUpErr.message, 'error');
        setLoading(false);
        return;
      }
      if (data.user) {
        const { error: pErr } = await supabase.from('profiles').upsert({
          id: data.user.id,
          role,
          phone: fullPhone,
          full_name: '',
        });
        if (pErr) toast('Profile setup issue', 'error');
      }
      setStep('name');
      setLoading(false);
      return;
    }
    // Signed in existing user — check profile
    await refreshProfile();
    setLoading(false);
  };

  const completeProfile = async () => {
    if (!name.trim()) {
      toast('Please enter your name', 'error');
      return;
    }
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast('Session lost', 'error');
      setLoading(false);
      return;
    }
    const { error } = await supabase.from('profiles').upsert({
      id: u.user.id,
      role,
      full_name: name.trim(),
      email: email.trim() || null,
      phone: fullPhone,
    });
    if (error) toast(error.message, 'error');
    await refreshProfile();
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-50 via-white to-white">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-md mx-auto w-full">
        <div className="mb-8 animate-slide-up">
          <Logo size="lg" />
        </div>

        {step === 'role' && (
          <div className="w-full animate-slide-up">
            <h1 className="text-2xl font-extrabold text-ink-900 text-center mb-1">Welcome to GharFix</h1>
            <p className="text-ink-500 text-center mb-8">Home services at your doorstep</p>
            <div className="space-y-3">
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setRole(r.key);
                    setStep('phone');
                  }}
                  className="w-full card p-4 flex items-center gap-4 hover:shadow-glow hover:border-brand-200 transition-all active:scale-[0.98] text-left"
                >
                  <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center">
                    <r.icon className="text-brand-700" size={22} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-ink-900">{r.label}</p>
                    <p className="text-sm text-ink-500">{r.desc}</p>
                  </div>
                  <ArrowRight className="text-ink-300" size={18} />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'phone' && (
          <div className="w-full animate-slide-up">
            <button onClick={() => setStep('role')} className="text-sm text-ink-500 mb-6 hover:text-ink-700">
              ← Change role
            </button>
            <h1 className="text-2xl font-extrabold text-ink-900 mb-1">Enter mobile number</h1>
            <p className="text-ink-500 mb-8">We'll send a one-time password to verify</p>
            <div className="flex items-center gap-2 rounded-2xl border border-ink-200 bg-white px-4 py-3 focus-within:ring-2 focus-within:ring-brand-400 transition">
              <span className="font-semibold text-ink-700">+91</span>
              <div className="w-px h-5 bg-ink-200" />
              <Phone size={18} className="text-ink-400" />
              <input
                className="flex-1 bg-transparent outline-none text-ink-900 placeholder:text-ink-400"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="numeric"
                maxLength={10}
                autoFocus
              />
            </div>
            <button className="btn-primary w-full mt-6" onClick={sendOtp} disabled={loading}>
              {loading ? <Spinner /> : 'Send OTP'}
            </button>
            <p className="text-xs text-ink-400 text-center mt-4 flex items-center justify-center gap-1">
              <ShieldCheck size={14} /> Your number is safe with us
            </p>
          </div>
        )}

        {step === 'otp' && (
          <div className="w-full animate-slide-up">
            <button onClick={() => setStep('phone')} className="text-sm text-ink-500 mb-6 hover:text-ink-700">
              ← Change number
            </button>
            <h1 className="text-2xl font-extrabold text-ink-900 mb-1">Verify OTP</h1>
            <p className="text-ink-500 mb-8">
              Sent to <span className="font-semibold text-ink-700">{fullPhone}</span>
            </p>
            <input
              className="input text-center text-2xl tracking-[0.5em] font-bold"
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoFocus
            />
            <button className="btn-primary w-full mt-6" onClick={verifyOtp} disabled={loading}>
              {loading ? <Spinner /> : 'Verify & Continue'}
            </button>
            <button className="text-sm text-brand-600 mt-4 mx-auto block" onClick={sendOtp}>
              Resend OTP
            </button>
          </div>
        )}

        {step === 'name' && (
          <div className="w-full animate-slide-up">
            <h1 className="text-2xl font-extrabold text-ink-900 mb-1">Complete your profile</h1>
            <p className="text-ink-500 mb-8">Tell us a bit about you</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-ink-700 mb-1.5 block">Full name</label>
                <input
                  className="input"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-ink-700 mb-1.5 block">Email (optional)</label>
                <input
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <button className="btn-primary w-full mt-6" onClick={completeProfile} disabled={loading}>
              {loading ? <Spinner /> : 'Get Started'}
            </button>
          </div>
        )}

      </div>
      <p className="text-center text-xs text-ink-400 pb-6 px-6">
        By continuing you agree to GharFix's Terms & Privacy Policy
      </p>
    </div>
  );
}
