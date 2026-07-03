import * as React from "react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { apiFetchBlob } from "@/lib/api-client";

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    title: string;
    fileUrl: string;
    type?: string;
  } | null;
}

export function DocumentViewer({ isOpen, onClose, document }: DocumentViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !document?.fileUrl) {
      setBlobUrl(null);
      return;
    }

    let mounted = true;
    let currentBlobUrl: string | null = null;

    const fetchFile = async () => {
      setLoading(true);
      setError(null);
      try {
        // Robust prefix stripping: handle both /api/ and api/
        const endpoint = document.fileUrl.replace(/^(\/)?api\//, '/');

        const blob = await apiFetchBlob(endpoint);
        if (mounted) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
        }
      } catch (err: any) {
        if (mounted) {
          console.error("Failed to load document:", err);
          const msg = err.message || "This file is protected and could not be loaded.";
          setError(`${msg} Please ensure you are logged in.`);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchFile();

    return () => {
      mounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [isOpen, document?.fileUrl]);

  if (!document) return null;

  const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(document.fileUrl) || document.type?.includes("IMAGE");
  const isPdf = /\.pdf$/i.test(document.fileUrl) || document.type?.includes("PDF") || document.type === "CONTRACT" || document.type === "REPORT";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-4 border-b bg-card flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {isImage ? <ImageIcon className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
            </div>
            <div className="text-left">
              <DialogTitle className="text-lg font-display font-bold leading-tight truncate max-w-[300px] md:max-w-md">
                {document.title}
              </DialogTitle>
              <DialogDescription className="text-xs uppercase tracking-wider font-bold opacity-70">
                {document.type || (isPdf ? "PDF Document" : isImage ? "Image" : "File")}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 mr-8">
            {blobUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2"
                onClick={() => window.open(blobUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Open Original</span>
              </Button>
            )}
            <a href={blobUrl || '#'} download={document.title}>
              <Button
                variant="hero"
                size="sm"
                className="h-9 gap-2 shadow-premium"
                disabled={!blobUrl}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </a>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-muted/20 relative overflow-hidden flex items-center justify-center p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm font-medium animate-pulse">Retrieving secure document...</p>
            </div>
          ) : error ? (
            <div className="text-center p-8 bg-card rounded-2xl border border-destructive/20 shadow-soft max-w-md">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Access Denied</h3>
              <p className="text-muted-foreground text-sm mb-6">{error}</p>
              <Button variant="outline" onClick={onClose}>Close Viewer</Button>
            </div>
          ) : isImage && blobUrl ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={blobUrl}
                alt={document.title}
                className="max-w-full max-h-full object-contain shadow-lg rounded-lg animate-in fade-in zoom-in-95 duration-500"
              />
            </div>
          ) : isPdf && blobUrl ? (
            <iframe
              src={`${blobUrl}#toolbar=0`}
              className="w-full h-full border-none rounded-lg shadow-inner bg-white animate-in fade-in duration-500"
              title={document.title}
            />
          ) : (
            <div className="text-center p-12 bg-card rounded-2xl border border-border shadow-soft max-w-md">
              <FileText className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-xl font-display font-bold mb-2">Preview Not Available</h3>
              <p className="text-muted-foreground text-sm mb-6">
                This file type cannot be previewed directly in the browser. Please download the file to view its contents.
              </p>
              <a href={blobUrl || '#'} download={document.title}>
                <Button variant="hero" className="w-full gap-2 font-display font-bold" disabled={!blobUrl}>
                  <Download className="h-4 w-4" /> Download File
                </Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
