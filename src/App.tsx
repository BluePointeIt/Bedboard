import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components';
import { Dashboard, Beds, Patients, Login, Settings, Management, Reports } from './pages';
import { DemoProvider } from './context/DemoContext';
import { useAuth } from './hooks/useAuth';

const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

function AuthenticatedApp() {
  const { user, profile, loading, signIn, signUp, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={signIn} onSignUp={signUp} />;
  }

  return (
    <BrowserRouter>
      <Layout onSignOut={signOut} userName={profile?.full_name || user.email || ''}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/beds" element={<Beds />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/management" element={<Management />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function DemoApp() {
  const [userName] = useState('Demo User');

  return (
    <DemoProvider>
      <BrowserRouter>
        <Layout userName={userName}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/beds" element={<Beds />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/management" element={<Management />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </DemoProvider>
  );
}

function App() {
  if (supabaseConfigured) {
    return <AuthenticatedApp />;
  }

  return <DemoApp />;
}

export default App;
