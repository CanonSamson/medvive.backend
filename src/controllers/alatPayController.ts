import { Request, Response } from 'express'
import asyncWrapper from '../middlewares/asyncWrapper.js'
import { alatPayService } from '../services/alatPayService.js'
import logger from '../utils/logger.js'

// Interface for virtual account request body
export interface VirtualAccountRequestBody {
  amount: number
  currency: string
  orderId: string
  description: string
  customer: {
    email: string
    phone: string
    firstName: string
    lastName: string
    metadata?: { [key: string]: any }
  }
}

/**
 * Generate virtual account for bank transfer payments
 */
export const generateVirtualAccount = asyncWrapper(async (req: Request, res: Response) => {
  const requestData: VirtualAccountRequestBody = req.body

  // Basic validation
  const requiredFields: (keyof VirtualAccountRequestBody)[] = [ 'amount', 'currency', 'orderId', 'description', 'customer']
  const missingFields = requiredFields.filter(field => !requestData[field])
  
  if (missingFields.length > 0) {
    logger.warn('Virtual account generation failed - missing required fields', {
      missingFields,
      providedFields: Object.keys(requestData)
    })
    
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missingFields.join(', ')}`
    })
  }

  try {
    logger.info('Initiating virtual account generation', {
      orderId: requestData.orderId,
      amount: requestData.amount,
      currency: requestData.currency
    })

    const result = await alatPayService.generateVirtualAccount(requestData)

    if (result.success) {
      logger.info('Virtual account generated successfully', {
        orderId: requestData.orderId,
        virtualAccountNumber: result.data?.virtualAccountNumber
      })
      
      return res.status(200).json({
        success: true,
        message: 'Virtual account generated successfully',
        data: result.data
      })
    } else {
      logger.error('Virtual account generation failed', {
        orderId: requestData.orderId,
        error: result.error
      })
      
      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to generate virtual account'
      })
    }
  } catch (error: any) {
    logger.error('Unexpected error in virtual account generation', {
      message: error.message,
      stack: error.stack,
      orderId: requestData.orderId
    })
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error occurred while generating virtual account'
    })
  }
})

/**
 * Get AlertPay service status and configuration
 */
export const getServiceStatus = asyncWrapper(async (req: Request, res: Response) => {
  try {
    logger.info('Checking AlertPay service status')
    
    const status = await alatPayService.getConfigStatus()
    
    logger.info('AlertPay service status retrieved', {
      isConfigured: status.isConfigured,
      baseUrl: status.baseUrl,
      hasSubscriptionKey: status.hasSubscriptionKey
    })
    
    return res.status(200).json({
      success: true,
      message: 'AlertPay service status retrieved successfully',
      data: status,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    logger.error('Error retrieving AlertPay service status', {
      message: error.message,
      stack: error.stack
    })
    
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve service status',
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * Health check endpoint for AlertPay service
 */
export const healthCheck = asyncWrapper(async (req: Request, res: Response) => {
  try {
    logger.debug('AlertPay health check initiated')
    
    const status = await alatPayService.getConfigStatus()
    
    if (status.isConfigured) {
      return res.status(200).json({
        success: true,
        message: 'AlertPay service is healthy',
        timestamp: new Date().toISOString()
      })
    } else {
      return res.status(503).json({
        success: false,
        message: 'AlertPay service is not properly configured',
        timestamp: new Date().toISOString()
      })
    }
  } catch (error: any) {
    logger.error('AlertPay health check failed', {
      message: error.message,
      stack: error.stack
    })
    
    return res.status(503).json({
      success: false,
      message: 'AlertPay service is not available',
      timestamp: new Date().toISOString()
    })
  }
})

/**
 * Confirm transaction status for bank transfer payments
 */
export const confirmTransactionStatus = asyncWrapper(async (req: Request, res: Response) => {
  const { transactionId } = req.params
  const requestId = Math.random().toString(36).substring(7)

  logger.info('Transaction status confirmation request initiated', {
    requestId,
    transactionId,
    timestamp: new Date().toISOString()
  })

  // Validate transaction ID
  if (!transactionId || typeof transactionId !== 'string' || transactionId.trim().length === 0) {
    logger.warn('Transaction status confirmation failed - invalid transaction ID', {
      requestId,
      transactionId,
      providedType: typeof transactionId
    })
    return res.status(400).json({
      success: false,
      message: 'Valid transaction ID is required',
      requestId
    })
  }

  try {
    // Call AlertPay service to confirm transaction status
    logger.debug('Calling AlertPay service for transaction status', {
      requestId,
      transactionId: transactionId.trim()
    })

    const result = await alatPayService.confirmTransactionStatus(transactionId.trim())

    if (result.success) {
      logger.info('Transaction status retrieved successfully', {
        requestId,
        transactionId,
        status: result.data?.status,
        timestamp: new Date().toISOString()
      })

      return res.status(200).json({
        success: true,
        message: 'Transaction status retrieved successfully',
        data: result.data,
        requestId,
        timestamp: new Date().toISOString()
      })
    } else {
      logger.warn('AlertPay service returned error for transaction status', {
        requestId,
        transactionId,
        error: result.error,
        timestamp: new Date().toISOString()
      })

      return res.status(400).json({
        success: false,
        message: result.error || 'Failed to retrieve transaction status',
        requestId,
        timestamp: new Date().toISOString()
      })
    }
  } catch (error: any) {
    logger.error('Unexpected error during transaction status confirmation', {
      requestId,
      transactionId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })

    return res.status(500).json({
      success: false,
      message: 'Internal server error during transaction status confirmation',
      requestId,
      timestamp: new Date().toISOString()
    })
  }
})