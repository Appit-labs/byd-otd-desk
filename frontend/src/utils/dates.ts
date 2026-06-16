const FRIDAY = 5;
const SATURDAY = 6;

export function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== FRIDAY && day !== SATURDAY;
}

export function addWorkingDays(startDate: Date, numDays: number): Date {
  const result = new Date(startDate.getTime());
  let daysAdded = 0;

  while (daysAdded < numDays) {
    result.setDate(result.getDate() + 1);
    if (isWorkingDay(result)) {
      daysAdded++;
    }
  }

  return result;
}

/** Extra working days when accessories are selected (default fallback) */
export const ACCESSORIES_EXTRA_DAYS = 7;

/**
 * Calculate the promise date based on request type working days and optional accessories.
 * @param workingDays - number of working days for the request type (from settings metadata)
 * @param hasAccessories - whether accessories are selected
 * @returns The calculated promise date, or null if workingDays is invalid
 */
export function calculatePromiseDate(
  workingDays: number | undefined | null,
  hasAccessories: boolean,
): Date | null {
  if (workingDays == null || workingDays < 0) return null;
  const totalDays = hasAccessories ? workingDays + ACCESSORIES_EXTRA_DAYS : workingDays;
  return addWorkingDays(new Date(), totalDays);
}
