import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAgencyStore } from '@/lib/store';

export const AgencyAppearanceManager = () => {
  const { settings } = useAgencyStore();
  const location = useLocation();

  useEffect(() => {
    // Update favicon
    if (settings.favicon) {
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = settings.favicon;
    }

    // Update document title
    if (settings.agencyName) {
      const path = location.pathname;
      let suffix = 'Hirdan Marketing';
      
      if (path.startsWith('/dashboard')) {
        suffix = 'Dashboard';
      } else if (path.startsWith('/client/portal')) {
        suffix = 'Client Portal';
      } else if (path === '/login') {
        suffix = 'Admin Login';
      } else if (path === '/client/login') {
        suffix = 'Client Login';
      }
      
      document.title = `${settings.agencyName} | ${suffix}`;
    }
  }, [settings.favicon, settings.agencyName, location.pathname]);

  // Handle Google Analytics injection
  useEffect(() => {
    if (settings.googleAnalyticsEnabled && settings.googleAnalyticsMeasurementId) {
      const measurementId = settings.googleAnalyticsMeasurementId.trim();
      if (measurementId) {
        const scriptId = 'google-analytics-gtag';
        let script = document.getElementById(scriptId) as HTMLScriptElement;
        if (!script) {
          script = document.createElement('script');
          script.id = scriptId;
          script.async = true;
          script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
          document.head.appendChild(script);

          const inlineScript = document.createElement('script');
          inlineScript.id = 'google-analytics-init';
          inlineScript.innerHTML = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}', { page_path: window.location.pathname });
          `;
          document.head.appendChild(inlineScript);
        }
      }
    } else {
      const script = document.getElementById('google-analytics-gtag');
      const inlineScript = document.getElementById('google-analytics-init');
      if (script) script.remove();
      if (inlineScript) inlineScript.remove();
    }
  }, [settings.googleAnalyticsEnabled, settings.googleAnalyticsMeasurementId]);

  // Track page views on location changes
  useEffect(() => {
    if (settings.googleAnalyticsEnabled && settings.googleAnalyticsMeasurementId) {
      const measurementId = settings.googleAnalyticsMeasurementId.trim();
      if (measurementId && (window as any).gtag) {
        (window as any).gtag('config', measurementId, {
          page_path: location.pathname + location.search
        });
      }
    }
  }, [location.pathname, location.search, settings.googleAnalyticsEnabled, settings.googleAnalyticsMeasurementId]);

  return null;
};
