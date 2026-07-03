import { useAgencyStore } from "@/lib/store";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, CloudUpload } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const GlobalUploadProgress = () => {
  const { globalUploadProgress, isGlobalUploading } = useAgencyStore();
  const [isVisible, setIsVisible] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (isGlobalUploading) {
      setIsVisible(true);
      setCompleted(false);
    } else if (globalUploadProgress === 100) {
      setCompleted(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setCompleted(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isGlobalUploading, globalUploadProgress]);

  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-[9999] w-72 md:w-80 transition-all duration-500 transform animate-in slide-in-from-bottom-5",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
    )}>
      <div className={cn(
        "bg-background/95 backdrop-blur-md border rounded-2xl p-4 shadow-2xl overflow-hidden relative group transition-colors duration-300",
        completed ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-primary/20"
      )}>
        {/* Animated Background Pulse */}
        {!completed && (
          <div className="absolute inset-0 bg-primary/5 animate-pulse" />
        )}

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-lg transition-colors",
                completed ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-primary/10 text-primary"
              )}>
                {completed ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <CloudUpload className="h-4 w-4 animate-bounce" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-foreground">
                  {completed ? "Upload Complete" : "Uploading File..."}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium">
                  {completed ? "Asset synced to server" : `${globalUploadProgress}% synced`}
                </p>
              </div>
            </div>
            {!completed && (
              <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
            )}
          </div>

          <div className="space-y-1.5">
            <Progress 
              value={globalUploadProgress} 
              className={cn("h-1.5 transition-all duration-500")}
              indicatorClassName={completed ? "bg-emerald-500" : "bg-primary"}
            />
          </div>
        </div>

        {/* Decorative corner accent */}
        <div className={cn(
          "absolute -top-6 -right-6 w-12 h-12 rotate-45 transition-colors",
          completed ? "bg-emerald-500/10" : "bg-primary/5"
        )} />
      </div>
    </div>
  );
};
