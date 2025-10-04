// custom-types.d.ts
import { Request } from "express";

declare module "express-serve-static-core" {
  interface Request {
    id?: string;
    roles?: string[];
    channelRoles?: string[];
  }
}

// Type definitions for OTP and Patient data
export interface PatientData {
  email: string;
  fullName: string;
  emailVerification?: boolean;
  emailVerifiedAt?: string;
}

export interface OTPData {
  otp: string;
  email: string;
  expiresAt: string;
  attempts: number;
  verified: boolean;
  createdAt: string;
  verifiedAt?: string;
}
