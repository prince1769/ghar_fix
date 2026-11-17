import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { CustomerApp } from '@/components/customer/CustomerApp';
import { ProviderApp } from '@/components/provider/ProviderApp';
import { AdminApp } from '@/components/admin/AdminApp';
import { ToastHost, LoadingScreen } from '@/components/ui/Feedback';

function Router() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingScreen label="Loading GharFix..." />
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthScreen />;
  }

  if (profile.role === 'customer') return <CustomerApp />;
  if (profile.role === 'provider') return <ProviderApp />;
  if (profile.role === 'admin') return <AdminApp />;

  return <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
      <ToastHost />
    </AuthProvider>
  );
}
