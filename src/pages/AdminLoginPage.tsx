import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/auth-store';
import { useAgencyStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, Eye, EyeOff, ArrowRight, Lock, Mail } from 'lucide-react';
import hirdanLogo from '@/assets/hirdan-logo.png';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { loginAdmin, isAuthenticated, user } = useAuthStore();
  const { settings } = useAgencyStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  // Redirect if already logged in as admin
  if (isAuthenticated && user?.role === 'admin') {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Brief delay for UX feel
    await new Promise((r) => setTimeout(r, 600));

    const success = await loginAdmin(email, password);
    setIsLoading(false);

    if (success) {
      toast({
        title: 'Welcome back!',
        description: 'You have been logged in successfully.',
      });
      navigate(from, { replace: true });
    } else {
      toast({
        title: 'Login failed',
        description: 'Invalid email or password. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-hero relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-secondary/5 blur-[120px]" />
        <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-secondary/3 blur-[200px]" />
      </div>

      {/* Left side branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative z-10">
        <div>
          <img src={hirdanLogo} alt={settings.agencyName} className="h-12 mb-4" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="text-5xl font-display font-bold text-white leading-tight mb-6">
            Agency<br />
            <span className="text-gradient-gold">Command Center</span>
          </h1>
          <p className="text-lg text-white/50 max-w-md leading-relaxed">
            Manage clients, projects, invoices, and your entire agency operation from one powerful dashboard.
          </p>
          <div className="flex items-center gap-8 mt-12">
            {[['Secure', '256-bit'], ['Fast', '<100ms'], ['Reliable', '99.9%']].map(([label, value]) => (
              <div key={label}>
                <div className="text-2xl font-display font-bold text-secondary">{value}</div>
                <div className="text-sm text-white/40">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
        <p className="text-sm text-white/30">© 2026 {settings.agencyName}. All rights reserved.</p>
      </div>

      {/* Right side login form */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-[440px]"
        >
          <div className="bg-card rounded-3xl shadow-elevated border border-border/50 p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 mb-5 shadow-lg">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">Admin Login</h2>
              <p className="text-muted-foreground mt-2 text-sm">Sign in to access your agency dashboard</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-sm font-medium text-foreground">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@hirdan.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-sm font-medium text-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-12 h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
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
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold text-sm shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30"
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
            <Link to="/" className="text-sm text-white/40 hover:text-white/70 transition-colors">
              ← Back to website
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
