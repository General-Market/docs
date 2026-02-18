/**
 * Utility for merging class names, filtering out falsy values
 * Handles undefined, null, false, and empty strings
 * @param classes - Class names to merge
 * @returns Merged class string
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
