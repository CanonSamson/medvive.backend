/**
 * Generates a random 5-digit OTP
 * @returns {string} A 5-digit OTP string
 */
export function generateOTP(): string {
  return Math.floor(10000 + Math.random() * 90000).toString()
}