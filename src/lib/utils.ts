import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAgencyStore } from "./store";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: string | number) {
  const { currency } = useAgencyStore.getState().settings;
  
  // Handle empty or invalid amounts
  if (amount === undefined || amount === null || amount === '') return '';

  // Handle strings with periods/intervals like "$499/mo" or "$100/hr"
  if (typeof amount === 'string' && amount.includes('/')) {
    const parts = amount.split('/');
    const pricePart = parts[0];
    const periodPart = parts.slice(1).join('/');
    
    let numericAmount = parseFloat(pricePart.replace(/[^0-9.-]+/g, ""));
    if (isNaN(numericAmount)) numericAmount = 0;
    
    const formattedPrice = new Intl.NumberFormat('en-DJ', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numericAmount);
    
    return `${formattedPrice}/${periodPart}`;
  }

  // Strip non-numeric characters if it's a string (like "$1,200")
  let numericAmount = typeof amount === 'string' 
    ? parseFloat(amount.replace(/[^0-9.-]+/g, "")) 
    : amount;

  if (isNaN(numericAmount)) numericAmount = 0;

  return new Intl.NumberFormat('en-DJ', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

export function parseCurrency(amount: string | number): number {
  if (typeof amount === 'number') return amount;
  if (!amount) return 0;
  // Remove currency symbols, commas, and anything that isn't a digit, dot, or minus sign
  // Split on '/' in case of things like "$499/mo"
  const clean = amount.split('/')[0].replace(/[^0-9.-]+/g, "");
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatDate(date: string | Date | undefined | null) {
  if (!date || date === 'N/A') return 'N/A';
  
  const { timezone } = useAgencyStore.getState().settings;
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Check for invalid date
  if (isNaN(d.getTime())) return String(date);
  
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeZone: timezone,
    }).format(d);
  } catch (e) {
    return String(date);
  }
}

export function formatDateTime(date: string | Date | undefined | null) {
  if (!date || date === 'N/A') return 'N/A';
  
  const { timezone } = useAgencyStore.getState().settings;
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Check for invalid date
  if (isNaN(d.getTime())) return String(date);
  
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(d);
  } catch (e) {
    return String(date);
  }
}

/** Coerce subscription/package `features` from DB/API (JSON string, double-encoded JSON, or array) to string[]. */
export function normalizeFeatureList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((x) => String(x));
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
      if (typeof parsed === "string") {
        const inner = parsed.trim();
        if (!inner) return [];
        try {
          const again = JSON.parse(inner);
          if (Array.isArray(again)) return again.map((x) => String(x));
        } catch {
          /* treat inner as plain text */
        }
        return [inner];
      }
    } catch {
      return [trimmed];
    }
    return [];
  }
  return [];
}
