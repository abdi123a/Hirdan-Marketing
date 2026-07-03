import { useState, useEffect } from "react";
import { apiFetchBlob } from "@/lib/api-client";

export interface ProtectedBrandingImageProps {
  src: string;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
}

export function ProtectedBrandingImage({ src, alt, style, className }: ProtectedBrandingImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    
    // Normalize legacy root-level upload paths (e.g. /uploads/file-xxx.png)
    // to /uploads/branding/file-xxx.png so the file router can serve them.
    let resolvedSrc = src;
    const rootUploadMatch = src.match(/^\/uploads\/([^/]+\.[a-z0-9]+)$/i);
    if (rootUploadMatch) {
      resolvedSrc = `/uploads/branding/${rootUploadMatch[1]}`;
    }
    
    // If it's not a protected URL, use it directly
    const isProtected = resolvedSrc.startsWith('/api/files/') || 
                       resolvedSrc.startsWith('/uploads/branding/') || 
                       resolvedSrc.startsWith('/uploads/documents/') || 
                       resolvedSrc.startsWith('/uploads/media/');
                       
    if (!isProtected) {
        setBlobUrl(resolvedSrc);
        return;
    }

    let mounted = true;
    const fetchImage = async () => {
      try {
        const blob = await apiFetchBlob(resolvedSrc);
        if (mounted) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      } catch (err) {
        console.error("Failed to load branding image:", err);
      }
    };

    fetchImage();

    return () => {
      mounted = false;
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [src]);

  if (!blobUrl) return null;
  return <img src={blobUrl} alt={alt} style={style} className={className} />;
}
