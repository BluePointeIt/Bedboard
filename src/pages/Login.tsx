import { useState } from 'react';
import { Icon } from '../components';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<{ error: Error | null }>;
  onSignUp?: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
}

export function Login({ onLogin, onSignUp }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSignUpSuccess(false);

    try {
      let result;
      if (isSignUp && onSignUp) {
        result = await onSignUp(email, password, fullName);
      } else {
        result = await onLogin(email, password);
      }

      if (result.error) {
        setError(result.error.message);
      } else if (isSignUp) {
        // Signup successful - show confirmation message
        setSignUpSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f6f7f8]">
      {/* Left Side: Healthcare Environment Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary-500/10">
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-primary-500/40 to-transparent" />
        <div
          className="w-full h-full bg-cover bg-center"
          style={{
            backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDoqTHHuuvAF0TXT97EsPogizc3dQJtV-IKFT_9thFOE8FSMzaUAwwgieXq79g4wqBkZrNtpAYi3j4wZJ7ahNyuYIDC1GyUEn3b9TvF8Vz15vTMfVJ18_n298HfzTUmOffpk8uTFzZeSXyUmbZuljHVAYzjUn3Lu_tgzC6gD4o7DW_cruBll-AF_hI2-C_zYV0ZLyMpNCZTr9yUITj8CTyZ793Y9cRAo9MV9OZrTjyGc5anph3--sdK4S6XE3OMPkdQTDrQpNuTgGE')`,
          }}
        />
        <div className="absolute bottom-12 left-12 z-20 text-white max-w-md">
          <h1 className="text-4xl font-extrabold mb-4 drop-shadow-md">MediBed Pro</h1>
          <p className="text-lg font-medium opacity-90 drop-shadow-sm">
            The industry standard for professional resident occupancy and bed management.
          </p>
          <div className="mt-8 flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
            <Icon name="verified_user" size={32} className="text-white" />
            <p className="text-sm">
              Trusted by healthcare facilities nationwide for HIPAA-compliant data tracking.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side: Authentication Panel */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 bg-[#f6f7f8]">
        <div className="w-full max-w-[440px] flex flex-col">
          {/* Logo & Heading */}
          <div className="mb-10 text-center lg:text-left">
            <div className="flex items-center gap-2 mb-6 justify-center lg:justify-start">
              <div className="w-10 h-10 bg-primary-500 text-white flex items-center justify-center rounded-lg shadow-lg shadow-primary-500/20">
                <Icon name="health_metrics" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">MediBed Pro</h2>
            </div>
            <h3 className="text-3xl font-bold text-slate-900 mb-2">
              {isSignUp ? 'Create Account' : 'Secure Portal Login'}
            </h3>
            <p className="text-slate-500 font-medium">
              {isSignUp
                ? 'Fill in your details to create a new account.'
                : 'Enter your credentials to access the management dashboard.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name Field (Sign Up Only) */}
            {isSignUp && (
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-semibold flex items-center gap-2">
                  <Icon name="badge" size={16} className="text-slate-400" />
                  Full Name
                </label>
                <input
                  type="text"
                  required={isSignUp}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-14 px-4 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                  placeholder="Enter your full name"
                />
              </div>
            )}

            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2">
                <Icon name="person" size={16} className="text-slate-400" />
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 px-4 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                placeholder="e.g. j.doe@facility.com"
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-700 text-sm font-semibold flex items-center gap-2">
                <Icon name="lock" size={16} className="text-slate-400" />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 px-4 pr-12 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-500 transition-colors"
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={20} />
                </button>
              </div>
            </div>

            {/* Options Row (Login Only) */}
            {!isSignUp && (
              <div className="flex items-center justify-between py-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-primary-500 focus:ring-primary-500 w-4 h-4 transition-all"
                  />
                  <span className="text-sm font-medium text-slate-600 group-hover:text-primary-500">
                    Remember me
                  </span>
                </label>
                <button
                  type="button"
                  className="text-sm font-bold text-primary-500 hover:underline transition-all"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                <Icon name="error" size={18} />
                {error}
              </div>
            )}

            {/* Sign Up Success Message */}
            {signUpSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg flex items-start gap-3">
                <Icon name="check_circle" size={20} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Sign up successful!</p>
                  <p className="mt-1">Please check your email and click the confirmation link to activate your account.</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-400 text-white font-bold rounded-lg shadow-lg shadow-primary-500/30 transition-all flex items-center justify-center gap-2 text-lg"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                <>
                  <Icon name={isSignUp ? 'person_add' : 'login'} size={22} />
                  {isSignUp ? 'Create Account' : 'Log In'}
                </>
              )}
            </button>
          </form>

          {/* Toggle Sign Up / Sign In */}
          {onSignUp && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setSignUpSuccess(false);
                }}
                className="text-sm font-medium text-slate-600 hover:text-primary-500 transition-colors"
              >
                {isSignUp ? (
                  <>
                    Already have an account?{' '}
                    <span className="font-bold text-primary-500">Sign in</span>
                  </>
                ) : (
                  <>
                    Don't have an account?{' '}
                    <span className="font-bold text-primary-500">Sign up</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Footer Info */}
          <div className="mt-10 pt-8 border-t border-slate-200 flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
                System Status: Online
              </span>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <div className="flex items-center gap-1.5 grayscale opacity-70">
                <Icon name="shield_with_heart" size={18} />
                <span className="text-[10px] font-bold uppercase tracking-tight">HIPAA Compliant</span>
              </div>
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex items-center gap-1.5 grayscale opacity-70">
                <Icon name="encrypted" size={18} />
                <span className="text-[10px] font-bold uppercase tracking-tight">256-bit Encryption</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center">
              Authorized Use Only. All activities are monitored and logged.
              <br />
              © 2024 MediBed Pro Technologies LLC.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
