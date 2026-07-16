import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgencyStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import hirdanLogo from '@/assets/hirdan-logo.png';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { settings } = useAgencyStore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok && res.status !== 200) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: 'Something went wrong',
          description: data.message || 'Please try again later.',
          variant: 'destructive',
        });
        return;
      }

      setSubmitted(true);
    } catch (err) {
      toast({
        title: 'Network error',
        description: 'Could not reach the server. Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
        className="w-full max-w-[440px] relative z-10"
      >
        <div className="bg-card rounded-3xl shadow-elevated border border-border/50 p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <img
              src={settings.logo || hirdanLogo}
              alt={settings.agencyName}
              className="h-14 mx-auto mb-6"
            />
          </div>

          <AnimatePresence mode="wait">
            {submitted ? (
              /* Success State */
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="text-center space-y-4"
              >
                <div className="flex justify-center mb-2">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-foreground">Check your email</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If an account with <strong className="text-foreground">{email}</strong> exists, we've sent a password reset link.
                  The link will expire in <strong>1 hour</strong>.
                </p>
                <p className="text-xs text-muted-foreground/70 pt-1">
                  Didn't receive it? Check your spam folder or try again.
                </p>
                <div className="pt-2 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full h-11 rounded-xl text-sm font-medium"
                    onClick={() => { setSubmitted(false); setEmail(''); }}
                  >
                    Try a different email
                  </Button>
                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Sign In
                  </Link>
                </div>
              </motion.div>
            ) : (
              /* Request Form */
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-foreground mb-1">Forgot your password?</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email" className="text-sm font-medium text-foreground">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                        required
                        autoComplete="email"
                        autoFocus
                      />
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
                        <Send className="mr-2 h-4 w-4" />
                        Send Reset Link
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Sign In
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
