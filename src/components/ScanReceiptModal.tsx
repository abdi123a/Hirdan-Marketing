import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiUpload } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Camera, FileImage, Sparkles, X, Loader2 } from "lucide-react";
import { ExpenseCategory } from "@/pages/ExpensesPage";

interface ScanReceiptModalProps {
  onClose: () => void;
  onComplete: (data: {
    receiptUrl: string;
    extracted: {
      amount?: number;
      description?: string;
      date?: string;
      category?: ExpenseCategory;
    } | null;
  }) => void;
}

export function ScanReceiptModal({ onClose, onComplete }: ScanReceiptModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.type.startsWith("image/") && selected.type !== "application/pdf") {
        toast({ title: "Invalid file type. Please upload an image or PDF.", variant: "destructive" });
        return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  const handleScan = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("receipt", file);

      const res = await apiUpload<{
        receiptUrl: string;
        extracted: {
          amount?: number;
          description?: string;
          date?: string;
          category?: ExpenseCategory;
        } | null;
        message?: string;
      }>("/expenses/scan", formData);

      if (res.message) {
        toast({ title: res.message });
      } else {
        toast({ title: "Receipt parsed successfully using AI!" });
      }

      onComplete({
        receiptUrl: res.receiptUrl,
        extracted: res.extracted,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to scan receipt", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            AI Receipt Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,application/pdf"
            className="hidden"
          />

          {!previewUrl ? (
            <div
              onClick={triggerSelect}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center gap-3"
            >
              <div className="h-12 w-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium">Click to upload or take a photo</p>
                <p className="text-xs text-muted-foreground mt-1">Supports PNG, JPG, WEBP, or PDF</p>
              </div>
            </div>
          ) : (
            <div className="relative border rounded-xl overflow-hidden bg-muted/40 aspect-video flex items-center justify-center">
              {file?.type.startsWith("image/") ? (
                <img
                  src={previewUrl}
                  alt="Receipt Preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FileImage className="h-10 w-10 text-violet-500" />
                  <span className="text-xs font-medium">{file?.name}</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                }}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
                disabled={loading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          {previewUrl && (
            <Button
              type="button"
              onClick={handleScan}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Scan with AI
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
