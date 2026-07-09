import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileText, AlertCircle } from "lucide-react";
import { apiFetchBlob } from "@/lib/api-client";

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | null;
  fileLabel: string;
}

export default function FilePreviewModal({
  isOpen,
  onClose,
  fileUrl,
  fileLabel,
}: FilePreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !fileUrl) {
      // Cleanup on close
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setFileType(null);
      setError(null);
      return;
    }

    const fetchFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = fileUrl.startsWith("/api") ? fileUrl.substring(4) : fileUrl;
        const blob = await apiFetchBlob(endpoint);
        const objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        setFileType(blob.type);
      } catch (err: any) {
        console.error("Failed to load file preview:", err);
        setError(err?.message || "Failed to load document preview. Please try downloading the file instead.");
      } finally {
        setLoading(false);
      }
    };

    fetchFile();

    return () => {
      // Cleanup on unmount or URL change
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, fileUrl]);

  const handleDownload = () => {
    if (!previewUrl || !fileUrl) return;
    const link = document.createElement("a");
    link.href = previewUrl;
    // Extract file name from URL or use label
    const extension = fileUrl.split(".").pop();
    const filename = `${fileLabel || "document"}.${extension}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isPdf = fileType?.includes("pdf") || fileUrl?.toLowerCase().endsWith(".pdf");
  const isImage = fileType?.includes("image") || 
    fileUrl?.toLowerCase().endsWith(".png") || 
    fileUrl?.toLowerCase().endsWith(".jpg") || 
    fileUrl?.toLowerCase().endsWith(".jpeg") || 
    fileUrl?.toLowerCase().endsWith(".gif") || 
    fileUrl?.toLowerCase().endsWith(".webp");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-4 sm:p-6 gap-4">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 pr-6 select-none shrink-0">
          <div className="space-y-1">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate max-w-[250px] sm:max-w-[450px]">{fileLabel || "Document Preview"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Secure in-app file preview
            </DialogDescription>
          </div>
          {previewUrl && !loading && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-8 gap-1.5 font-bold uppercase text-[10px] tracking-wider shrink-0 bg-background hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          )}
        </DialogHeader>

        <div className="flex-1 w-full min-h-0 bg-muted/20 border rounded-xl overflow-hidden flex items-center justify-center relative">
          {loading && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Loading Preview...</p>
            </div>
          )}

          {error && !loading && (
            <div className="max-w-md text-center p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Unable to Display Preview</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
              </div>
              {fileUrl && (
                <Button onClick={handleDownload} size="sm" className="font-bold uppercase text-xs tracking-wider gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download Instead
                </Button>
              )}
            </div>
          )}

          {previewUrl && !loading && !error && (
            <>
              {isImage ? (
                <div className="w-full h-full p-4 flex items-center justify-center bg-checkered">
                  <img
                    src={previewUrl}
                    alt={fileLabel}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md border"
                  />
                </div>
              ) : isPdf ? (
                <iframe
                  src={`${previewUrl}#toolbar=0`}
                  title={fileLabel}
                  className="w-full h-full border-0 bg-background"
                />
              ) : (
                <div className="text-center p-6 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold">Preview Not Supported</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      We cannot preview files of this format directly in your browser.
                    </p>
                  </div>
                  <Button onClick={handleDownload} size="sm" className="font-bold uppercase text-xs tracking-wider gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Download File
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
