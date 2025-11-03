import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'

// Middleware to check if the user's token is verified
export const verifyUserToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1] // Extract token from the Authorization header

  if (!token) {
    res.status(401).json({ message: 'Token not provided' })
    return // Ensure the function exits here
  }

  try {
    const secretKey = process.env.JWT_SECRET_KEY  as string
    const decoded = jwt.verify(token, secretKey) as {
      id: string
      role: 'PATIENT' | 'DOCTOR'
    }
    req.id = decoded.id // Attach user data (id) to the request object
    req.role = decoded.role as 'PATIENT' | 'DOCTOR' // Attach user data (id) to the request object
    next() // Proceed to the next middleware or route handler
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}
