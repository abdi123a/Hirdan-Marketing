import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react';

interface ClientPortalTourProps {
  clientId: string;
  open: boolean;
  onClose: () => void;
  allowedSections: string[];
}

// Full possible tour steps.
const ALL_TOUR_STEPS = [
  {
    id: 'welcome',
    title: '👋 Welcome to your portal!',
    description: 'This is your dedicated client dashboard. Everything about your account with us is here in one place — let us show you around.',
    icon: Sparkles,
  },
  {
    id: 'overview',
    title: '🏠 Overview',
    description: 'Your home screen. See your key stats at a glance — active tasks, projects, upcoming invoices, and social media performance — all in one view.',
  },
  {
    id: 'financials',
    title: '💰 Financials',
    description: 'View all your invoices and proformas. Download PDFs, track payment status, and see exactly what you\'ve invested and what\'s outstanding.',
  },
  {
    id: 'projects',
    title: '📋 Projects',
    description: 'Track the status and progress of every active project we\'re running for you. Know what\'s in progress, what\'s completed, and what\'s next.',
  },
  {
    id: 'subscriptions',
    title: '⚡ Subscriptions',
    description: 'See your active service plans, renewal dates, and what\'s included in your package.',
  },
  {
    id: 'social',
    title: '📱 Social Media',
    description: 'Review the deliverables and content tasks we\'re working on for your social media channels. Approve work and track progress here.',
  },
  {
    id: 'planner',
    title: '📅 Planner',
    description: 'Browse the content calendar — see what posts are planned, in review, or published each month.',
  },
  {
    id: 'documents',
    title: '📄 Documents',
    description: 'Access contracts, brand guides, reports, and any files we\'ve shared with you.',
  },
  {
    id: 'done',
    title: '✅ You\'re all set!',
    description: 'That\'s everything! You can revisit this tour anytime from your Account settings. Click \'Get Started\' to explore your dashboard.',
    icon: Check,
  }
];

export function ClientPortalTour({ clientId, open, onClose, allowedSections }: ClientPortalTourProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Only include welcome + allowed sections + done
  const activeSteps = ALL_TOUR_STEPS.filter(step => {
    if (step.id === 'welcome' || step.id === 'done') return true;
    return allowedSections.includes(step.id);
  });

  // Handle close and save to local storage
  const handleClose = () => {
    localStorage.setItem(`portal_tour_done_${clientId}`, '1');
    onClose();
  };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  const step = activeSteps[currentStep];
  const isLast = currentStep === activeSteps.length - 1;
  const isFirst = currentStep === 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-card w-full max-w-md rounded-2xl shadow-premium border border-border/50 overflow-hidden relative flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-end p-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:bg-muted/50 rounded-full"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body content with slide animation */}
          <div className="px-8 pb-4 flex-1 flex flex-col items-center justify-center text-center min-h-[200px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center w-full"
              >
                {step.icon && (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <step.icon className="h-8 w-8 text-primary" />
                  </div>
                )}
                <h2 className="text-2xl font-display font-bold text-foreground mb-3">
                  {step.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {step.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center justify-center gap-1.5 py-6">
            {activeSteps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          {/* Footer Navigation */}
          <div className="p-6 pt-0 flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={isFirst}
              className={`text-xs ${isFirst ? 'opacity-0 pointer-events-none' : ''}`}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>

            {!isLast ? (
              <Button
                variant="hero"
                size="sm"
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="shadow-premium px-6"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                variant="hero"
                size="sm"
                onClick={handleClose}
                className="shadow-premium px-6"
              >
                Get Started
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
