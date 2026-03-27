import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Database, User, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import hirdanLogo from '@/assets/hirdan-logo.png';

export default function SetupPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    dbHost: 'localhost',
    dbPort: '3306',
    dbName: '',
    dbUser: '',
    dbPassword: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const testDbConnection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.dbHost || !formData.dbName || !formData.dbUser) {
      toast({ title: 'Error', description: 'Database Host, Name, and User are required', variant: 'destructive' });
      return;
    }
    
    setIsTestingDb(true);
    // Brief delay for UX feel
    await new Promise((r) => setTimeout(r, 600));

    const url = `mysql://${formData.dbUser}:${formData.dbPassword}@${formData.dbHost}:${formData.dbPort}/${formData.dbName}`;
    
    try {
      await apiFetch('/install/test-db', {
        method: 'POST',
        body: JSON.stringify({ databaseUrl: url }),
      });
      toast({ title: 'Success', description: 'Database connection successful!' });
      setStep(2);
    } catch (error: any) {
      toast({ title: 'Connection Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsTestingDb(false);
    }
  };

  const finalizeSetup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (formData.adminPassword !== formData.confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    // Brief delay for UX feel
    await new Promise((r) => setTimeout(r, 800));

    const url = `mysql://${formData.dbUser}:${formData.dbPassword}@${formData.dbHost}:${formData.dbPort}/${formData.dbName}`;

    try {
      await apiFetch('/install/finalize', {
        method: 'POST',
        body: JSON.stringify({
          databaseUrl: url,
          adminName: formData.adminName,
          adminEmail: formData.adminEmail,
          adminPassword: formData.adminPassword,
        }),
      });
      setStep(3);
    } catch (error: any) {
      toast({ title: 'Setup Failed', description: error.message, variant: 'destructive' });
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
        className="w-full max-w-[500px] relative z-10"
      >
        <div className="bg-card rounded-3xl shadow-elevated border border-border/50 p-8 md:p-10">
          
          <div className="text-center mb-8">
            <img src={hirdanLogo} alt="Agency Flow Pro" className="h-14 mx-auto mb-6" />
            <h2 className="text-2xl font-display font-bold text-foreground">Agency Command Center</h2>
            <p className="text-muted-foreground mt-2 text-sm">System Initialization Setup</p>
          </div>

          <div className="mb-6 flex overflow-hidden rounded-lg bg-muted/30 border border-border/50">
            {[
              { id: 1, label: 'Database' },
              { id: 2, label: 'Admin User' },
              { id: 3, label: 'Complete' }
            ].map(s => (
              <div 
                key={s.id} 
                className={`flex-1 text-center py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  step >= s.id 
                    ? 'bg-primary/10 text-primary border-b-2 border-primary' 
                    : 'text-muted-foreground/60'
                }`}
              >
                {s.label}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Database Details</h3>
                    <p className="text-xs text-muted-foreground">MySQL credentials for system persistence.</p>
                  </div>
                </div>

                <form onSubmit={testDbConnection} className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5 col-span-2">
                      <Label htmlFor="dbHost" className="text-xs font-medium text-foreground">Host</Label>
                      <Input 
                        id="dbHost" 
                        placeholder="localhost" 
                        value={formData.dbHost || ''} 
                        onChange={handleInputChange}
                        className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-1">
                      <Label htmlFor="dbPort" className="text-xs font-medium text-foreground">Port</Label>
                      <Input 
                        id="dbPort" 
                        placeholder="3306" 
                        value={formData.dbPort || ''} 
                        onChange={handleInputChange}
                        className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="dbName" className="text-xs font-medium text-foreground">Database Name</Label>
                    <Input 
                      id="dbName" 
                      placeholder="agency_db" 
                      value={formData.dbName || ''} 
                      onChange={handleInputChange}
                      className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="dbUser" className="text-xs font-medium text-foreground">Username</Label>
                      <Input 
                        id="dbUser" 
                        placeholder="root" 
                        value={formData.dbUser || ''} 
                        onChange={handleInputChange}
                        className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dbPassword" className="text-xs font-medium text-foreground">Password</Label>
                      <Input 
                        id="dbPassword" 
                        type="password" 
                        placeholder="••••••••" 
                        value={formData.dbPassword || ''} 
                        onChange={handleInputChange}
                        className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit"
                    className="w-full h-12 mt-6 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold text-sm shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30"
                    disabled={isTestingDb || !formData.dbHost || !formData.dbName || !formData.dbUser}
                  >
                    {isTestingDb ? (
                      <motion.div
                        className="w-5 h-5 mr-3 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                      />
                    ) : null}
                    Test Connection & Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Administrator</h3>
                    <p className="text-xs text-muted-foreground">The initial super admin account.</p>
                  </div>
                </div>

                <form onSubmit={finalizeSetup} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="adminName" className="text-xs font-medium text-foreground">Full Name</Label>
                    <Input 
                      id="adminName" 
                      placeholder="Admin Name" 
                      value={formData.adminName} 
                      onChange={handleInputChange}
                      className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="adminEmail" className="text-xs font-medium text-foreground">Email Address</Label>
                    <Input 
                      id="adminEmail" 
                      type="email" 
                      placeholder="admin@example.com" 
                      value={formData.adminEmail} 
                      onChange={handleInputChange}
                      className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="adminPassword" className="text-xs font-medium text-foreground">Password</Label>
                      <Input 
                        id="adminPassword" 
                        type="password" 
                        placeholder="••••••••" 
                        value={formData.adminPassword} 
                        onChange={handleInputChange}
                        className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">Confirm</Label>
                      <Input 
                        id="confirmPassword" 
                        type="password" 
                        placeholder="••••••••" 
                        value={formData.confirmPassword} 
                        onChange={handleInputChange}
                        className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card text-sm transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-8">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="h-12 px-6 rounded-xl border-border/50 hover:bg-muted/50 transition-colors"
                      onClick={() => setStep(1)} 
                      disabled={isLoading}
                    >
                      Back
                    </Button>
                    <Button 
                      type="submit"
                      className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold text-sm shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30"
                      disabled={isLoading || !formData.adminName || !formData.adminEmail || !formData.adminPassword}
                    >
                      {isLoading ? (
                        <motion.div
                          className="w-5 h-5 mr-3 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                        />
                      ) : null}
                      Finish Initialization
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold font-display text-foreground">Setup Complete!</h2>
                <div className="space-y-4 mt-4 text-sm text-muted-foreground/80">
                  <p>
                    The database has been configured and your administrator account is ready.
                  </p>
                  <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 text-primary/90 text-xs text-left">
                    <strong className="block mb-1 text-primary">System Reload Required</strong>
                    Please manually restart your backend NodeJS server for the environmental variables to initialize the system completely.
                  </div>
                </div>
                
                <Button 
                  className="w-full h-12 mt-8 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold text-sm shadow-lg shadow-primary/25 transition-all duration-300"
                  onClick={() => {
                    window.location.href = '/login';
                  }}
                >
                  Go to Login Dashboard
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </div>
  );
}
