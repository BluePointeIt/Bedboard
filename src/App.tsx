import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AppLayout } from './components';
import { useAuth } from './hooks/useAuth';

// Code-split page components for better initial load performance
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Residents = lazy(() => import('./pages/Residents').then(m => ({ default: m.Residents })));
const Admissions = lazy(() => import('./pages/Admissions').then(m => ({ default: m.Admissions })));
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

// Loading fallback for lazy-loaded components
function PageLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  );
}

function AuthenticatedApp() {
  const { user, loading, signIn, signUp, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoading />}>
        <Login onLogin={signIn} onSignUp={signUp} />
      </Suspense>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout user={user} onSignOut={signOut} />}>
          <Route path="/" element={<Navigate to="/analytics" replace />} />
          <Route path="/dashboard" element={<Suspense fallback={<PageLoading />}><Dashboard /></Suspense>} />
          <Route path="/residents" element={<Suspense fallback={<PageLoading />}><Residents /></Suspense>} />
          <Route path="/admissions" element={<Suspense fallback={<PageLoading />}><Admissions /></Suspense>} />
          <Route path="/analytics" element={<Suspense fallback={<PageLoading />}><Analytics /></Suspense>} />
          <Route path="/reports" element={<Suspense fallback={<PageLoading />}><Reports /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageLoading />}><Settings /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/analytics" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function UnauthenticatedApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/analytics" replace />} />
          <Route path="/dashboard" element={<Suspense fallback={<PageLoading />}><Dashboard /></Suspense>} />
          <Route path="/residents" element={<Suspense fallback={<PageLoading />}><Residents /></Suspense>} />
          <Route path="/admissions" element={<Suspense fallback={<PageLoading />}><Admissions /></Suspense>} />
          <Route path="/analytics" element={<Suspense fallback={<PageLoading />}><Analytics /></Suspense>} />
          <Route path="/reports" element={<Suspense fallback={<PageLoading />}><Reports /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageLoading />}><Settings /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/analytics" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  if (supabaseConfigured) {
    return <AuthenticatedApp />;
  }

  // Run without authentication when Supabase is not configured
  return <UnauthenticatedApp />;
}

export default App;
