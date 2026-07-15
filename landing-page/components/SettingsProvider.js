"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

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
  const [settings, setSettings] = useState(null);
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
    const fetchSettings = async () => {
      console.log("[DEBUG SettingsProvider] fetchSettings starting...");
      let data = null;
      try {
        const response = await fetch(`${apiBaseUrl}/api/settings`).catch((err) => {
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
                links.forEach(link => {
                  link.href = faviconUrl;
                });
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
          }
        }

        const lpResponse = await fetch(`${apiBaseUrl}/api/landing-page/content`).catch((err) => null);
        if (lpResponse && lpResponse.ok) {
          const lpData = await lpResponse.json();
          setLandingPageContent(lpData.content);
          setCaseStudies(lpData.caseStudies || []);
          setProjects(lpData.projects || []);
          setTestimonials(lpData.testimonials || []);

          if (lpData.content) {
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

            // Dynamic Title Update with SEO Title prioritisation
            const pageTitle = lpData.content.seoTitle || 
              (data && data.settings && data.settings.agencyName ? `${data.settings.agencyName} | Elevating Your Brand` : "SEOX");
            document.title = pageTitle;

            // Standard SEO description
            if (lpData.content.seoDescription) {
              setMetaTag('name', 'description', lpData.content.seoDescription);
            }

            // Standard SEO keywords
            if (lpData.content.seoKeywords) {
              setMetaTag('name', 'keywords', lpData.content.seoKeywords);
            }

            // Open Graph (Facebook / LinkedIn) & Twitter SEO Card
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
        console.log("[DEBUG SettingsProvider] fetchSettings finally block, setting isLoading to false");
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [apiBaseUrl]);

  return (
    <SettingsContext.Provider value={{ settings, landingPageContent, caseStudies, projects, testimonials, isLoading, apiBaseUrl, appUrl, resolveImageUrl }}>
      {children}
    </SettingsContext.Provider>
  );
}
