import { useEffect } from 'react';

interface ReCAPTCHAProps {
  siteKey: string;
  onChange: (token: string | null) => void;
}

/**
 * Invisible reCAPTCHA v3 component.
 * Automatically executes on mount and refreshes the token every 90 seconds.
 * No user interaction required — no checkbox, no puzzle.
 */
export default function ReCAPTCHA({ siteKey, onChange }: ReCAPTCHAProps) {
  useEffect(() => {
    if (!siteKey) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let destroyed = false;

    const executeToken = () => {
      if (destroyed) return;
      (window as any).grecaptcha
        .execute(siteKey, { action: 'login' })
        .then((token: string) => {
          if (!destroyed) onChange(token);
        })
        .catch(() => {
          if (!destroyed) onChange(null);
        });
    };

    const startTokenRefresh = () => {
      executeToken();
      // Refresh the token every 90 s (tokens expire after 2 min)
      intervalId = setInterval(executeToken, 90_000);
    };

    const initRecaptcha = () => {
      (window as any).grecaptcha.ready(startTokenRefresh);
    };

    const scriptId = 'recaptcha-v3-script';

    if ((window as any).grecaptcha) {
      // Script already loaded — jump straight to ready()
      initRecaptcha();
    } else {
      // Load the v3 script once
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      }
      script.addEventListener('load', initRecaptcha, { once: true });
    }

    return () => {
      destroyed = true;
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [siteKey, onChange]);

  // v3 is fully invisible — just show the policy badge
  return (
    <p className="text-xs text-center text-muted-foreground mt-1">
      Protected by{' '}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-foreground"
      >
        reCAPTCHA
      </a>
      .
    </p>
  );
}
