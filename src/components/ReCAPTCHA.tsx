import { useEffect, useRef } from 'react';

interface ReCAPTCHAProps {
  siteKey: string;
  onChange: (token: string | null) => void;
  /** 'v2' renders a visible checkbox. 'v3' runs invisibly and auto-generates a token. Defaults to 'v3'. */
  version?: 'v2' | 'v3';
}

export default function ReCAPTCHA({ siteKey, onChange, version = 'v3' }: ReCAPTCHAProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const tokenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const scriptId = 'recaptcha-script';

    const executeV3 = () => {
      (window as any).grecaptcha.ready(() => {
        (window as any).grecaptcha
          .execute(siteKey, { action: 'login' })
          .then((token: string) => {
            onChange(token);
          })
          .catch(() => {
            onChange(null);
          });

        // Re-execute every 90 seconds to refresh the token before it expires
        if (tokenIntervalRef.current) clearInterval(tokenIntervalRef.current);
        tokenIntervalRef.current = setInterval(() => {
          (window as any).grecaptcha
            .execute(siteKey, { action: 'login' })
            .then((token: string) => onChange(token))
            .catch(() => onChange(null));
        }, 90_000);
      });
    };

    const renderV2Widget = () => {
      if ((window as any).grecaptcha && containerRef.current && widgetIdRef.current === null) {
        try {
          const widgetId = (window as any).grecaptcha.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => onChange(token),
            'expired-callback': () => onChange(null),
            'error-callback': () => onChange(null),
          });
          widgetIdRef.current = widgetId;
        } catch (err) {
          console.error('reCAPTCHA v2 render error:', err);
        }
      }
    };

    const onScriptLoad = () => {
      if (version === 'v3') {
        executeV3();
      } else {
        renderV2Widget();
      }
    };

    // Load the appropriate script
    const existingScript = document.getElementById(scriptId);
    if (!(window as any).grecaptcha) {
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = scriptId;
        if (version === 'v3') {
          script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
        } else {
          const callbackName = '__recaptchaOnloadV2';
          (window as any)[callbackName] = onScriptLoad;
          script.src = `https://www.google.com/recaptcha/api.js?onload=${callbackName}&render=explicit`;
        }
        script.async = true;
        script.defer = true;
        script.onload = version === 'v3' ? onScriptLoad : undefined;
        document.body.appendChild(script);
      } else {
        // Script exists but grecaptcha not ready yet — wait for it
        existingScript.addEventListener('load', onScriptLoad, { once: true });
      }
    } else {
      onScriptLoad();
    }

    return () => {
      if (tokenIntervalRef.current) {
        clearInterval(tokenIntervalRef.current);
        tokenIntervalRef.current = null;
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, version, onChange]);

  // v3 is invisible; v2 renders a visible checkbox
  if (version === 'v3') {
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

  return <div ref={containerRef} className="flex justify-center my-4" />;
}
