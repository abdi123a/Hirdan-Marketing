import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAgencyStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react';
import hirdanLogo from '@/assets/hirdan-logo.png';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-orange-500' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-yellow-500' };
  if (score <= 4) return { score, label: 'Strong', color: 'bg-emerald-500' };
  return { score, label: 'Very Strong', color: 'bg-emerald-600' };
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { settings } = useAgencyStore();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword && newPassword !== confirmPassword;

  // If no token in URL, show an error
  const hasToken = !!token;

  useEffect(() => {
    if (!hasToken) return;
  }, [hasToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both password fields match.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Reset failed',
          description: data.message || 'Invalid or expired reset link.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Password reset successful!',
        description: 'You can now log in with your new password.',
      });

      // Redirect to login after a short delay
      setTimeout(() => navigate('/login', { replace: true }), 1500);
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

          {!hasToken ? (
            /* Invalid/Missing Token */
            <div className="text-center space-y-4">
              <div className="flex justify-center mb-2">
                <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-foreground">Invalid Reset Link</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This password reset link is missing or invalid. Please request a new one.
              </p>
              <Link
                to="/forgot-password"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white font-semibold text-sm mt-4"
              >
                <ShieldCheck className="h-4 w-4" />
                Request New Reset Link
              </Link>
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            /* Reset Password Form */
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground mb-1">Set a new password</h2>
                <p className="text-sm text-muted-foreground">
                  Choose a strong password for your account. It must be at least 8 characters.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm font-medium text-foreground">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-12 h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                      required
                      autoFocus
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-1.5"
                    >
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                              i <= strength.score ? strength.color : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Strength: <span className={`font-semibold ${
                          strength.score <= 1 ? 'text-red-500'
                          : strength.score <= 2 ? 'text-orange-500'
                          : strength.score <= 3 ? 'text-yellow-600'
                          : 'text-emerald-600'
                        }`}>{strength.label}</span>
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`pl-10 pr-12 h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all ${
                        passwordsMismatch ? 'border-red-400 focus:border-red-400' : ''
                      } ${passwordsMatch ? 'border-emerald-400' : ''}`}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordsMismatch && (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                  {passwordsMatch && (
                    <p className="text-xs text-emerald-600">Passwords match ✓</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !!passwordsMismatch || !newPassword || !confirmPassword}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold text-sm shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <motion.div
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    />
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Reset Password
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
            </>
          )}
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
