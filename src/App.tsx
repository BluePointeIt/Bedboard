import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components';
import { Admin, Dashboard, Residents, Admissions, Analytics, Login, Settings, Reports } from './pages';
import { useAuth } from './hooks/useAuth';
import { canAccessRoute } from './lib/permissions';
import type { User } from './types';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Protected route component that checks permissions before rendering.
 * Redirects to Analytics page if user doesn't have access.
 */
function ProtectedRoute({
  children,
  route,
  profile,
}: {
  children: React.ReactNode;
  route: string;
  profile: User | null;
}) {
  // If no profile yet (still loading), show the component anyway
  // This prevents flickering while profile loads
  if (!profile) {
    return <>{children}</>;
  }

  // Check if user can access this route
  if (!canAccessRoute(profile, route)) {
    return <Navigate to="/analytics" replace />;
  }

  return <>{children}</>;
}

function AuthenticatedRoutes() {
  const {
    user,
    profile,
    loading,
    currentFacility,
    accessibleFacilities,
    setCurrentFacility,
    signIn,
    signUp,
    signOut,
  } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={signIn} onSignUp={signUp} />;
  }

  return (
    <Routes>
      <Route
        element={
          <AppLayout
            user={user}
            profile={profile}
            currentFacility={currentFacility}
            accessibleFacilities={accessibleFacilities}
            onFacilityChange={setCurrentFacility}
            onSignOut={signOut}
          />
        }
      >
        <Route path="/" element={<Navigate to="/analytics" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/residents" element={<Residents />} />
        <Route path="/admissions" element={<Admissions />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/reports" element={<Reports />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute route="/settings" profile={profile}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute route="/admin" profile={profile}>
              <Admin />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/analytics" replace />} />
    </Routes>
  );
}

function UnauthenticatedRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/analytics" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/residents" element={<Residents />} />
        <Route path="/admissions" element={<Admissions />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/analytics" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      {supabaseConfigured ? <AuthenticatedRoutes /> : <UnauthenticatedRoutes />}
    </BrowserRouter>
  );
}

export default App;
