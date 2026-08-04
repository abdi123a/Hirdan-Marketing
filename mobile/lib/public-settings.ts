import { Platform } from 'react-native';
import {
  Recaptcha,
  RecaptchaAction,
  type RecaptchaClient,
} from '@google-cloud/recaptcha-enterprise-react-native';
import { endpoints } from '@hirdan/shared';
import { getFullUrl } from './api-client';

export type PublicAuthSettings = {
  enableRecaptcha: boolean;
  recaptchaSiteKey?: string | null;
  recaptchaAndroidSiteKey?: string | null;
  recaptchaIosSiteKey?: string | null;
};

let clientPromise: Promise<RecaptchaClient> | null = null;
let clientSiteKey: string | null = null;

export async function fetchPublicAuthSettings(): Promise<PublicAuthSettings> {
  try {
    const res = await fetch(getFullUrl(endpoints.settings.public), {
      headers: { 'X-Client-Platform': 'mobile' },
    });
    if (!res.ok) return { enableRecaptcha: false };
    const data = await res.json();
    return {
      enableRecaptcha: Boolean(data?.settings?.enableRecaptcha),
      recaptchaSiteKey: data?.settings?.recaptchaSiteKey || null,
      recaptchaAndroidSiteKey: data?.settings?.recaptchaAndroidSiteKey || null,
      recaptchaIosSiteKey: data?.settings?.recaptchaIosSiteKey || null,
    };
  } catch {
    return { enableRecaptcha: false };
  }
}

function resolveMobileSiteKey(settings: PublicAuthSettings): string | null {
  const fromEnv =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RECAPTCHA_IOS_SITE_KEY
      : process.env.EXPO_PUBLIC_RECAPTCHA_ANDROID_SITE_KEY;
  if (fromEnv) return fromEnv;
  if (Platform.OS === 'ios') return settings.recaptchaIosSiteKey || null;
  return settings.recaptchaAndroidSiteKey || null;
}

async function getClient(siteKey: string): Promise<RecaptchaClient> {
  if (!clientPromise || clientSiteKey !== siteKey) {
    clientSiteKey = siteKey;
    clientPromise = Recaptcha.fetchClient(siteKey);
  }
  return clientPromise;
}

/** Returns a LOGIN token when Application-type keys are configured; otherwise null. */
export async function getMobileRecaptchaToken(
  settings?: PublicAuthSettings
): Promise<string | null> {
  const cfg = settings || (await fetchPublicAuthSettings());
  if (!cfg.enableRecaptcha) return null;

  const siteKey = resolveMobileSiteKey(cfg);
  if (!siteKey) return null;

  const client = await getClient(siteKey);
  return client.execute(RecaptchaAction.LOGIN());
}
