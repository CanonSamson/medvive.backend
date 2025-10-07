import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import logger from '../utils/logger.js'

// Zod schema for virtual account generation request
const virtualAccountSchema = z.object({
  amount: z.number().positive('Amount must be a positive number'),
  currency: z.string().length(3, 'Currency must be a 3-letter code (e.g., NGN, USD)'),
  orderId: z.string().min(1, 'Order ID is required'),
  description: z.string().min(1, 'Description is required'),
  customer: z.object({
    email: z.string().email('Valid email is required'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    metadata: z.record(z.string(), z.string()).optional()
  })
})

// Zod schema for transaction status confirmation request
const transactionStatusSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required').trim()
})

/**
 * Middleware to validate transaction status confirmation request
 */
export const validateTransactionStatusRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = Math.random().toString(36).substring(7)
  logger.debug('AlertPay validation: Starting transaction status request validation', { 
    requestId, 
    params: req.params 
  })

  try {
    const result = transactionStatusSchema.safeParse(req.params)

    if (!result.success) {
      logger.warn('AlertPay validation: Transaction status request validation failed', {
        requestId,
        errors: result.error.issues,
        params: req.params
      })

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        })),
        requestId
      })
      return
    }

    logger.debug('AlertPay validation: Transaction status request validation successful', { 
      requestId,
      transactionId: result.data.transactionId
    })

    // Attach validated data to request params
    req.params = result.data
    next()
  } catch (error) {
    logger.error('AlertPay validation: Unexpected error during transaction status validation', {
      requestId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })

    res.status(500).json({
      success: false,
      message: 'Internal validation error',
      requestId
    })
  }
}

/**
 * Middleware to validate virtual account generation request
 */
export const validateVirtualAccountRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = Math.random().toString(36).substring(7)
  logger.debug('AlertPay validation: Starting virtual account request validation', { 
    requestId, 
    body: req.body 
  })

  try {
    const result = virtualAccountSchema.safeParse(req.body)

    if (!result.success) {
      logger.warn('AlertPay validation: Virtual account request validation failed', {
        requestId,
        errors: result.error.issues,
        body: req.body
      })

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }))
      })
      return
    }

    logger.debug('AlertPay validation: Virtual account request validation successful', { 
      requestId 
    })

    // Attach validated data to request for use in controller
    req.body = result.data
    next()
  } catch (error) {
    logger.error('AlertPay validation: Unexpected error during validation', {
      requestId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })

    res.status(500).json({
      success: false,
      message: 'Internal validation error'
    })
  }
}

/**
 * Generic validation middleware factory for other AlertPay endpoints
 */
export const validateSchema = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = Math.random().toString(36).substring(7)
    logger.debug('AlertPay validation: Starting schema validation', { 
      requestId, 
      body: req.body 
    })

    try {
      const result = schema.safeParse(req.body)

      if (!result.success) {
        logger.warn('AlertPay validation: Schema validation failed', {
          requestId,
          errors: result.error.issues,
          body: req.body
        })

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code
          }))
        })
        return
      }

      logger.debug('AlertPay validation: Schema validation successful', { 
        requestId 
      })

      // Attach validated data to request
      req.body = result.data
      next()
    } catch (error) {
      logger.error('AlertPay validation: Unexpected error during schema validation', {
        requestId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })

      res.status(500).json({
        success: false,
        message: 'Internal validation error'
      })
    }
  }
}