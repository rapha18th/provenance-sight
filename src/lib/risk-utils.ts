/**
 * Normalizes a raw risk score (e.g., 100-2000) to a user-friendly 0-100 scale
 * using a logarithmic curve.
 * @param score The raw risk score.
 * @returns A normalized score between 0 and 100.
 */
export function normalizeRisk(score: number | null | undefined): number {
  if (typeof score !== 'number' || isNaN(score)) return 0;

  const safeScore = Math.max(score, 1); // Prevent issues with 0 or negative numbers
  const offset = 100;                    // Shifts the curve to start ramping up around a raw score of 100
  const scale = 10;                      // Controls the steepness of the curve
  const maxScore = 100;                  // Cap the output score

  const normalized = Math.log(safeScore + offset) * scale;

  // Round to the nearest integer and ensure it doesn't exceed the max score
  return Math.min(Math.round(normalized), maxScore);
}

/**
 * Converts a normalized 0-100 score back to its approximate raw score.
 * This is the inverse of the normalizeRisk function.
 * @param normalizedScore The normalized score (0-100).
 * @returns The approximate raw risk score.
 */
export function denormalizeRisk(normalizedScore: number): number {
  if (typeof normalizedScore !== 'number' || isNaN(normalizedScore)) return 0;

  const offset = 100;
  const scale = 10;

  // If the normalized score is at the max, we can't know the true raw score,
  // but we can return a high number to represent "at least this much".
  // For filtering, this might not be perfect, but it's a reasonable approximation.
  if (normalizedScore >= 100) {
    return 10000; // A high raw score for filters when the slider is at max
  }

  const rawScore = Math.exp(normalizedScore / scale) - offset;

  return Math.round(rawScore);
}
