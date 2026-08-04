import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/auth-store';
import { useAgencyStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, ArrowRight, Lock, Mail } from 'lucide-react';
import hirdanLogo from '@/assets/hirdan-logo.png';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';

function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { loginAdmin, isAuthenticated, user } = useAuthStore();
  const { settings } = useAgencyStore();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const stateFrom = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const from = stateFrom && stateFrom !== '/login' ? stateFrom : '/dashboard';

  // Redirection logic for authenticated users
  useEffect(() => {
    if (isAuthenticated && user) {
      if (['admin', 'manager', 'staff'].includes(user.role)) {
        navigate(from, { replace: true });
      } else if (user.role === 'client') {
        navigate('/client/portal', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, from]);

  // Prevent rendering login form if already authenticated
  if (isAuthenticated && user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Brief delay for UX feel
    await new Promise((r) => setTimeout(r, 600));

    let recaptchaToken: string | undefined;
    if (settings.enableRecaptcha && executeRecaptcha) {
      recaptchaToken = await executeRecaptcha('admin_login');
    }

    const result = await loginAdmin(email, password, recaptchaToken);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: 'Welcome back!',
        description: 'You have been logged in successfully.',
      });
      navigate(from, { replace: true });
    } else {
      // Check if it's a client login attempt
      const isClientError = result.message?.toLowerCase().includes('client');

      if (isClientError) {
        toast({
          title: 'Incorrect Portal',
          description: result.message || 'Please log in through the Client Portal.',
          variant: 'destructive',
        });
        // Short delay to let the toast be seen
        setTimeout(() => {
          navigate('/client/login', { replace: true });
        }, 1500);
      } else {
        toast({
          title: 'Login failed',
          description: result.message || 'Invalid email or password. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-hero relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-secondary/5 blur-[120px]" />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-secondary/3 blur-[200px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="bg-card rounded-3xl border border-border/50 p-8 md:p-10">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            {/* Logo in a white pill — hides the PNG white background on dark hero */}
            <div className="bg-white rounded-2xl px-5 py-3 mb-6 inline-flex items-center justify-center">
              <img
                src={settings.logo || hirdanLogo}
                alt={settings.agencyName}
                className="h-10 w-auto"
              />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground">Admin Login</h2>
            <p className="text-muted-foreground mt-2 text-sm">Sign in to your dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-sm font-medium text-foreground">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all shadow-none"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-12 h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all shadow-none"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold text-sm transition-all duration-300 shadow-none"
            >
              {isLoading ? (
                <motion.div
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                />
              ) : (
                <>
                  Sign In <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Forgot password link */}
          <div className="text-center mt-4">
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              Forgot password?
            </Link>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-card text-muted-foreground">or</span>
            </div>
          </div>

          {/* Client portal link */}
          <Link
            to="/client/login"
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all duration-200"
          >
            Access Client Portal
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Back to site */}
        <div className="text-center mt-6">
          <a
            href={import.meta.env.VITE_LANDING_URL || 'https://hirdanmarketing.com'}
            className="text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            ← Back to website
          </a>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminLoginPage() {
  const { settings } = useAgencyStore();

  if (settings.enableRecaptcha && settings.recaptchaSiteKey) {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={settings.recaptchaSiteKey}>
        <AdminLoginForm />
      </GoogleReCaptchaProvider>
    );
  }

  return <AdminLoginForm />;
}
