import { useEffect, useRef } from 'react';

interface ReCAPTCHAProps {
  siteKey: string;
  onChange: (token: string | null) => void;
}

export default function ReCAPTCHA({ siteKey, onChange }: ReCAPTCHAProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    const callbackName = 'onRecaptchaLoaded';

    // Global callback for onload
    (window as any)[callbackName] = () => {
      renderWidget();
    };

    const renderWidget = () => {
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
          console.error('reCAPTCHA render error:', err);
        }
      }
    };

    if (!(window as any).grecaptcha) {
      // Avoid duplicate script injections
      const existingScript = document.getElementById('recaptcha-script');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'recaptcha-script';
        script.src = `https://www.google.com/recaptcha/api.js?onload=${callbackName}&render=explicit`;
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      }
    } else {
      renderWidget();
    }

    return () => {
      // We don't remove the script itself to prevent rendering issues on subsequent mounts,
      // but we do reset our internal widget reference.
      widgetIdRef.current = null;
    };
  }, [siteKey, onChange]);

  return <div ref={containerRef} className="flex justify-center my-4" />;
}
