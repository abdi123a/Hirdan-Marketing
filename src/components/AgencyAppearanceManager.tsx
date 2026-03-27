import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAgencyStore } from '@/lib/store';

export const AgencyAppearanceManager = () => {
  const { settings, fetchSettings } = useAgencyStore();
  const location = useLocation();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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
      let suffix = 'AgencyFlow';
      
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

  return null;
};
