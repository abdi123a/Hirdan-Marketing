// Brand glyphs and the platform config that references them.
//
// A .tsx module because these are JSX components; the plain-type half lives in
// ./types.ts so non-React callers do not pull JSX in.

import React from "react";
import { HelpCircle } from "lucide-react";

/* ---------------- Brand glyphs (simple, generic mono icons from user design) ---------------- */
export const XGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" style={style}>
    <path d="M18.9 2H22l-7.6 8.7L23 22h-6.6l-5.2-6.8L5.2 22H2l8.1-9.3L1.5 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20Z" />
  </svg>
);
export const FacebookGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" style={style}>
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
  </svg>
);
export const InstagramGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" style={style}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);
export const LinkedInGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" style={style}>
    <path d="M6.9 8.6H3.4V21h3.5V8.6ZM5.2 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM21 21h-3.5v-6.4c0-1.5 0-3.5-2.1-3.5s-2.5 1.7-2.5 3.4V21H9.4V8.6h3.4v1.7h.05c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5V21Z" />
  </svg>
);
export const TikTokGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" style={style}>
    <path d="M16.6 3c.4 2 1.7 3.4 3.9 3.7v2.6c-1.4 0-2.7-.4-3.9-1.3v6.6a5.6 5.6 0 1 1-4.8-5.5v2.7a3 3 0 1 0 2.1 2.8V3h2.7Z" />
  </svg>
);
export const YouTubeGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" style={style}>
    <path d="M9.8 15.5V8.5l6 3.5-6 3.5Z" />
  </svg>
);
export const ThreadsGlyph = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" style={style}>
    <path d="M12 21c-4.5 0-7.5-2.6-7.5-8.9C4.5 5.9 7.6 3 12 3s7.2 2.6 7.4 6.7c.1 2.7-1.1 4-3 4-1.7 0-2.6-1-2.7-2.3-.1-1.7.9-2.6.9-2.6M12.2 12.4c2 .1 3.4 1 3.3 2.8-.1 2-2 3-4 2.9-1.7-.1-3-1-2.9-2.5.1-1.8 2-2.5 3.6-2.5.6 0 1.2.1 1.7.3" />
  </svg>
);
export const YouTubeIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => {
  const isContrast = style?.color === "#fff" || style?.color === "white" || className?.includes("text-white") || style?.color === "inherit";
  
  if (!isContrast) {
    return (
      <svg viewBox="0 0 24 24" className={className} style={style}>
        <rect x="2" y="4.7" width="20" height="14.6" rx="4.5" fill="#FF0000" />
        <path d="M9.8 15.5V8.5l6 3.5-6 3.5Z" fill="white" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <defs>
        <mask id="yt-play-mask">
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <path d="M9.8 15.5V8.5l6 3.5-6 3.5Z" fill="black" />
        </mask>
      </defs>
      <rect x="2" y="4.7" width="20" height="14.6" rx="4.5" fill="currentColor" mask="url(#yt-play-mask)" />
    </svg>
  );
};

export const PLATFORMS_CONFIG = [
  { id: "x", label: "Twitter / X", color: "#000000", icon: XGlyph, limit: 280, hasThread: true },
  { id: "facebook", label: "Facebook", color: "#1877F2", icon: FacebookGlyph, limit: 63206, postTypes: ["Post", "Reel", "Story"] },
  { id: "instagram", label: "Instagram", color: "#D6249F", icon: InstagramGlyph, limit: 2200, postTypes: ["Post", "Reel", "Story"] },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2", icon: LinkedInGlyph, limit: 3000 },
  { id: "tiktok", label: "TikTok", color: "#000000", icon: TikTokGlyph, limit: 4000 },
  { id: "youtube", label: "YouTube", color: "#FF0000", icon: YouTubeIcon, limit: 5000 },
  { id: "threads", label: "Threads", color: "#000000", icon: ThreadsGlyph, limit: 500, hasThread: true },
];

/**
 * Brand logo for a platform, from the PNG set in /public/social-icons.
 *
 * Lives here rather than inline in a page because the publish flow shows these
 * in three places (composer, progress modal, destination rows) and they must
 * agree — the progress modal used to draw lucide glyphs on a coloured square
 * while the composer beside it showed the real logos.
 */
export function platformLogo(platform?: string, className = "h-4 w-4 rounded-sm object-contain") {
  const src = platformLogoSrc(platform);
  if (!src) return <HelpCircle className={`${className} text-muted-foreground`} />;
  return <img src={src} className={className} alt={platform} />;
}

export function platformLogoSrc(platform?: string): string | null {
  switch ((platform || "").toLowerCase()) {
    case "facebook": return "/social-icons/Facebook.png";
    case "instagram": return "/social-icons/instagram.png";
    case "threads": return "/social-icons/Threads.png";
    case "tiktok": return "/social-icons/tiktok.png";
    case "linkedin": return "/social-icons/linkedin.png";
    case "youtube": return "/social-icons/youtube.png";
    case "x":
    case "twitter": return "/social-icons/twitter.png";
    case "pinterest": return "/social-icons/pinterest.png";
    default: return null;
  }
}
