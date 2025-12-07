import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert Date to ISO UTC string (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function dateToISO(date: Date): string {
  return date.toISOString();
}

/**
 * Convert ISO UTC string to Date object (in local timezone)
 */
export function isoToDate(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Convert Date to ISO date string (YYYY-MM-DD) for date inputs
 */
export function dateToISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Convert ISO date string (YYYY-MM-DD) to Date object at midnight UTC
 */
export function isoDateStringToDate(isoDateString: string): Date {
  // Create date at midnight UTC
  return new Date(isoDateString + "T00:00:00.000Z");
}

/**
 * Generate a UUID v4. Uses crypto.randomUUID() if available, otherwise falls back to a polyfill.
 */
export function generateUUID(): string {
  // Check if crypto.randomUUID is available
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback polyfill for environments without crypto.randomUUID
  // This generates a UUID v4 compliant string
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
