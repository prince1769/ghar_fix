import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { CustomerHome } from './CustomerHome';
import { CategoriesList, CategoryDetail } from './Categories';
import { BookingFlow } from './BookingFlow';
import { TrackingScreen } from './TrackingScreen';
import { AddressesScreen, BookingsList, NotificationsScreen, SupportScreen, ProfileScreen } from './Misc';
import { Home, LayoutGrid, Calendar, User } from 'lucide-react';

type View =
  | { name: 'home' }
  | { name: 'categories' }
  | { name: 'category'; id: string }
  | { name: 'booking'; serviceId: string }
  | { name: 'tracking'; id: string }
  | { name: 'addresses' }
  | { name: 'bookings' }
  | { name: 'notifications' }
  | { name: 'support' }
  | { name: 'profile' };

const TAB_VIEWS = ['home', 'categories', 'bookings', 'profile'] as const;

export function CustomerApp() {
  const [view, setView] = useState<View>({ name: 'home' });

  const go = (name: string, params: Record<string, string> = {}) => {
    setView({ name: name as View['name'], ...params } as View);
    window.scrollTo(0, 0);
  };

  const tab = TAB_VIEWS.includes(view.name as (typeof TAB_VIEWS)[number]) ? view.name : 'home';
  const setTab = (t: string) => go(t);

  const nav = { tab, setTab };

  const showBottomNav = TAB_VIEWS.includes(view.name as (typeof TAB_VIEWS)[number]);

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen relative">
      {view.name === 'home' && <CustomerHome go={go} nav={nav} />}
      {view.name === 'categories' && <CategoriesList go={go} />}
      {view.name === 'category' && <CategoryDetail categoryId={view.id} go={go} />}
      {view.name === 'booking' && <BookingFlow serviceId={view.serviceId} go={go} />}
      {view.name === 'tracking' && <TrackingScreen bookingId={view.id} go={go} />}
      {view.name === 'addresses' && <AddressesScreen go={go} />}
      {view.name === 'bookings' && <BookingsList go={go} />}
      {view.name === 'notifications' && <NotificationsScreen go={go} />}
      {view.name === 'support' && <SupportScreen go={go} />}
      {view.name === 'profile' && <ProfileScreen go={go} nav={nav} />}

      {showBottomNav && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-ink-100 px-2 py-2 flex items-center justify-around z-30">
          {[
            { key: 'home', label: 'Home', icon: Home },
            { key: 'categories', label: 'Services', icon: LayoutGrid },
            { key: 'bookings', label: 'Bookings', icon: Calendar },
            { key: 'profile', label: 'Profile', icon: User },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => go(t.key)}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition ${tab === t.key ? 'text-brand-600' : 'text-ink-400'}`}
            >
              <t.icon size={20} strokeWidth={tab === t.key ? 2.5 : 2} />
              <span className="text-[11px] font-semibold">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
