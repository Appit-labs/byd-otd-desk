/**
 * Working days utility for BYD OTD Tracker.
 *
 * Working days = Sunday through Thursday (Friday & Saturday excluded).
 * Used for promise date calculation on car requests.
 */

const FRIDAY = 5;
const SATURDAY = 6;

/**
 * Returns true if the given date falls on a working day (Sun–Thu).
 */
export function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== FRIDAY && day !== SATURDAY;
}

/**
 * Adds `numDays` working days to `startDate`, skipping Fridays and Saturdays.
 * Returns a new Date object (immutable).
 *
 * @param startDate - The starting date
 * @param numDays   - Number of working days to add (must be >= 0)
 */
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
