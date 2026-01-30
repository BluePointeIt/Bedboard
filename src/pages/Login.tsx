import { useState } from 'react';
import { Hospital } from 'lucide-react';
import { Button } from '../components';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<{ error: Error | null }>;
  onSignUp?: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
}

export function Login({ onLogin, onSignUp }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;
      if (isSignUp && onSignUp) {
        result = await onSignUp(email, password, fullName);
      } else {
        result = await onLogin(email, password);
      }

      if (result.error) {
        setError(result.error.message);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mb-4">
            <Hospital className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Bedboard</h1>
          <p className="text-slate-500">Hospital Bed Management System</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required={isSignUp}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter your full name"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter your password"
                minLength={6}
              />
            </div>

            {error && (
              <div className="p-3 bg-danger-50 text-danger-600 text-sm rounded-lg">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          {onSignUp && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          For demo purposes, you can use any email/password.
          <br />
          Configure Supabase credentials for full functionality.
        </p>
      </div>
    </div>
  );
}
