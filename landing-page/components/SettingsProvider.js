"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import ComingSoon from "./ComingSoon";
import Preloader from "../layouts/Preloader";

// Read cached settings from localStorage immediately (avoids blank flash)
function getCachedSettings() {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem("agency_settings");
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
}

const SettingsContext = createContext({
  settings: null,
  landingPageContent: null,
  caseStudies: [],
  projects: [],
  testimonials: [],
  isLoading: true,
  apiBaseUrl: "https://api.hirdanmarketing.com",
  resolveImageUrl: (url) => url
});

export const useSettings = () => useContext(SettingsContext);

export default function SettingsProvider({ children }) {
  const pathname = usePathname() || "";
  // Initialize synchronously from localStorage on first render (lazy initializer).
  // This means developmentMode is known BEFORE the first paint — no flash of the wrong layout.
  const [settings, setSettings] = useState(() => getCachedSettings());
  const [landingPageContent, setLandingPageContent] = useState(null);
  const [caseStudies, setCaseStudies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:3001"
      : "https://api.hirdanmarketing.com");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:5173"
      : "https://app.hirdanmarketing.com/login");

  const resolveImageUrl = useCallback((url) => {
    if (!url) return "";
    if (url.startsWith("/uploads/") || url.startsWith("/api/files/")) return `${apiBaseUrl}${url}`;
    return url;
  }, [apiBaseUrl]);

  useEffect(() => {
    // On mount, also re-read cache synchronously in case useState ran on server (null)
    const cached = getCachedSettings();
    if (cached && !settings) {
      setSettings(cached);
    }

    const setMetaTag = (attrName, attrValue, content) => {
      if (typeof document === "undefined") return;
      let tag = document.querySelector(`meta[${attrName}='${attrValue}']`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attrName, attrValue);
        document.getElementsByTagName('head')[0].appendChild(tag);
      }
      tag.content = content;
    };

    const fetchSettings = async () => {
      let data = null;
      try {
        const response = await fetch(`${apiBaseUrl}/api/settings?t=${Date.now()}`, { cache: "no-store" }).catch((err) => {
          console.warn("API settings endpoint not reachable:", err.message);
          return null;
        });
        if (response && response.ok) {
          data = await response.json();
          if (data.settings) {
            setSettings(data.settings);
            if (typeof window !== "undefined") {
              localStorage.setItem("agency_settings", JSON.stringify(data.settings));
            }

            // Dynamic Favicon Update
            if (data.settings.favicon) {
              const faviconUrl = resolveImageUrl(data.settings.favicon);
              let links = document.querySelectorAll("link[rel*='icon']");
              if (links.length > 0) {
                links.forEach(link => { link.href = faviconUrl; });
              } else {
                const link = document.createElement('link');
                link.rel = 'icon';
                link.href = faviconUrl;
                document.getElementsByTagName('head')[0].appendChild(link);
              }
            }

            // Dynamic Title Update
            if (data.settings.agencyName) {
              document.title = `${data.settings.agencyName} | Elevating Your Brand`;
            }

            // Dynamic Brand Color Update
            if (data.settings.primaryColor) {
              document.documentElement.style.setProperty('--theme', data.settings.primaryColor);
            }

            // robots metadata if developmentMode is active
            if (data.settings.developmentMode) {
              setMetaTag('name', 'robots', 'noindex,nofollow');
            } else {
              setMetaTag('name', 'robots', 'index,follow');
            }

            // Google Analytics Injection
            if (data.settings.googleAnalyticsEnabled && data.settings.googleAnalyticsMeasurementId) {
              const measurementId = data.settings.googleAnalyticsMeasurementId.trim();
              if (measurementId && !document.getElementById('ga-gtag-script')) {
                const gtagScript = document.createElement('script');
                gtagScript.id = 'ga-gtag-script';
                gtagScript.async = true;
                gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
                document.head.appendChild(gtagScript);

                const initScript = document.createElement('script');
                initScript.id = 'ga-gtag-init';
                initScript.innerHTML = `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${measurementId}', { page_path: window.location.pathname });
                `;
                document.head.appendChild(initScript);
              }
            }
          }
        }

        const lpResponse = await fetch(`${apiBaseUrl}/api/landing-page/content?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
        if (lpResponse && lpResponse.ok) {
          const lpData = await lpResponse.json();
          setLandingPageContent(lpData.content);
          setCaseStudies(lpData.caseStudies || []);
          setProjects(lpData.projects || []);
          setTestimonials(lpData.testimonials || []);

          if (lpData.content) {
            const pageTitle = lpData.content.seoTitle ||
              (data && data.settings && data.settings.agencyName ? `${data.settings.agencyName} | Elevating Your Brand` : "SEOX");
            document.title = pageTitle;

            if (lpData.content.seoDescription) {
              setMetaTag('name', 'description', lpData.content.seoDescription);
            }
            if (lpData.content.seoKeywords) {
              setMetaTag('name', 'keywords', lpData.content.seoKeywords);
            }

            setMetaTag('property', 'og:title', pageTitle);
            setMetaTag('name', 'twitter:title', pageTitle);
            setMetaTag('property', 'og:type', 'website');
            setMetaTag('property', 'og:url', typeof window !== 'undefined' ? window.location.href : '');

            if (lpData.content.seoDescription) {
              setMetaTag('property', 'og:description', lpData.content.seoDescription);
              setMetaTag('name', 'twitter:description', lpData.content.seoDescription);
            }

            if (lpData.content.seoImage) {
              const fullImageUrl = resolveImageUrl(lpData.content.seoImage);
              setMetaTag('property', 'og:image', fullImageUrl);
              setMetaTag('name', 'twitter:image', fullImageUrl);
              setMetaTag('name', 'twitter:card', 'summary_large_image');
            } else if (data && data.settings && data.settings.logo) {
              const fullImageUrl = resolveImageUrl(data.settings.logo);
              setMetaTag('property', 'og:image', fullImageUrl);
              setMetaTag('name', 'twitter:image', fullImageUrl);
              setMetaTag('name', 'twitter:card', 'summary_large_image');
            }
          }
        }
      } catch (error) {
        console.error("[DEBUG SettingsProvider] Failed to fetch settings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [apiBaseUrl]);

  // Match legal pages regardless of trailing slash or static export path format
  const isLegalPage =
    pathname === "/privacy-policy" ||
    pathname === "/privacy-policy/" ||
    pathname === "/terms-of-service" ||
    pathname === "/terms-of-service/" ||
    pathname.startsWith("/privacy-policy") ||
    pathname.startsWith("/terms-of-service");

  // On non-legal pages: if we haven't resolved settings yet (no cache, API still pending),
  // show only the preloader — never show children before we know if Coming Soon is active.
  // This prevents the full site from flashing before Coming Soon appears.
  const settingsUnknown = settings === null && isLoading && !isLegalPage;

  return (
    <SettingsContext.Provider value={{ settings, landingPageContent, caseStudies, projects, testimonials, isLoading, apiBaseUrl, appUrl, resolveImageUrl }}>
      {/* Never show the preloader or coming-soon screen on legal pages */}
      {!isLegalPage && <Preloader />}
      {settingsUnknown ? null : settings?.developmentMode && !isLegalPage ? (
        <ComingSoon />
      ) : (
        children
      )}
    </SettingsContext.Provider>
  );
}
