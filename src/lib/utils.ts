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
