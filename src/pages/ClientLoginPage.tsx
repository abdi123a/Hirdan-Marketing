import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/auth-store';
import { useAgencyStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Mail, KeyRound } from 'lucide-react';
import hirdanLogo from '@/assets/hirdan-logo.png';

export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, user, loginClient } = useAuthStore();
  const { clients, settings } = useAgencyStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already logged in as client
  if (isAuthenticated && user?.role === 'client') {
    navigate('/client/portal', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await new Promise((r) => setTimeout(r, 600));

    const success = await loginClient(email, accessCode);
    setIsLoading(false);

    if (success) {
      toast({
        title: 'Welcome!',
        description: 'You have been signed in to your client portal.',
      });
      navigate('/client/portal', { replace: true });
    } else {
      toast({
        title: 'Login failed',
        description: 'Invalid email or access code.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-hero relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-32 left-20 w-80 h-80 rounded-full bg-secondary/6 blur-[120px]" />
        <div className="absolute bottom-32 right-20 w-64 h-64 rounded-full bg-primary/8 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-[440px] relative z-10"
      >
        <div className="bg-card rounded-3xl shadow-elevated border border-border/50 p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <img src={hirdanLogo} alt={settings.agencyName} className="h-14 mx-auto mb-6" />
            <h2 className="text-2xl font-display font-bold text-foreground">Client Portal</h2>
            <p className="text-muted-foreground mt-2 text-sm">Sign in to your client portal</p>
          </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="client-email" className="text-sm font-medium text-foreground">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="client-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-access-code" className="text-sm font-medium text-foreground">Access Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="client-access-code"
                    type="text"
                    placeholder="e.g. A3B7K9"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    className="pl-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm font-mono tracking-widest uppercase transition-all"
                    required
                    maxLength={6}
                    autoComplete="off"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Your access code was provided by your account manager.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/90 hover:to-secondary/70 text-white font-semibold text-sm shadow-lg shadow-secondary/25 transition-all duration-300 hover:shadow-xl hover:shadow-secondary/30"
              >
                {isLoading ? (
                  <motion.div
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  />
                ) : (
                  <>
                    Access Portal <ArrowRight className="ml-2 h-4 w-4" />
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

            {/* Admin login link */}
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all duration-200"
            >
              Admin Login
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
  );
}
