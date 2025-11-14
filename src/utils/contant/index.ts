export const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@medvive.ng'
export const EMAILS_FROM = {
  noreply: EMAIL_FROM,
  doctor: 'doctor@medvive.ng',
  patient: 'patient@medvive.ng',
  wallet: 'wallet@medvive.ng',
  system: 'system@medvive.ng',
  onboarding: 'onboarding@medvive.ng',
  consultation: 'consultation@medvive.ng',
  consumer: 'consumer@medvive.ng'

}

export type EmailFrom = keyof typeof EMAILS_FROM