import { DoctorData, PatientData } from '../../custom-types.js'
import asyncWrapper from '../middlewares/asyncWrapper.js'
import { alatPayService } from '../services/alatPayService.js'
import { chargesService } from '../services/chargesService.js'
import { ConsultationService } from '../services/consultationService.js'
import {
  getDBAdmin,
  createDBAdmin,
  updateDBAdmin
} from '../utils/firebase/admin-database.js'
import { getAdminFirestore } from '../utils/firebase/admin.js'
import logger from '../utils/logger.js'
import { v4 as uuidv4 } from 'uuid'

export const initializeConsultation = asyncWrapper(async (req, res) => {
  const { patientId, doctorId, date, time, patientSymptoms } = req.body as {
    date: string
    time: string
    doctorId: string
    patientId: string
    patientSymptoms: {
      symptoms: string
      otherSymptoms: string
      duration: string
      moreDetails: string
    }
  }

  const consultationId = uuidv4()
  const timestamp = new Date().toISOString()

  const patientRecord = await getDBAdmin('patients', patientId)
  const doctorRecord = await getDBAdmin('doctors', doctorId)

  if (!patientRecord?.data || !doctorRecord?.data) {
    logger.warn(
      'initializeConsultation: Patient or Doctor not found in database',
      {
        patientId,
        doctorId,
        patientRecord,
        doctorRecord
      }
    )
    return res.status(404).json({
      error: 'Patient or Doctor not found',
      success: false,
      patientRecord,
      doctorRecord
    })
  }

  // Check if patient has any pending consultations
  try {
    const db = getAdminFirestore()
    const pendingConsultationsQuery = await db
      .collection('consultations')
      .where('patientId', '==', patientId)
      .where('status', '==', 'PENDING')
      .where('active', '==', true)
      .get()

    if (!pendingConsultationsQuery.empty) {
      const pendingConsultations = pendingConsultationsQuery.docs.map(
        (doc: any) => ({
          id: doc.id,
          ...doc.data()
        })
      )

      logger.warn('initializeConsultation: Patient has pending consultations', {
        patientId,
        pendingConsultationsCount: pendingConsultations.length,
        pendingConsultations
      })

      return res.status(409).json({
        error:
          'Patient already has pending consultations. Please complete or cancel existing consultations before booking a new one.',
        success: false,
        pendingConsultations,
        pendingConsultationsCount: pendingConsultations.length
      })
    }
  } catch (error) {
    logger.error('Error checking for pending consultations:', error)
    return res.status(500).json({
      error: 'Failed to check for pending consultations',
      success: false
    })
  }

  const patientData = patientRecord.data as PatientData
  const doctorData = doctorRecord.data as DoctorData

  if (!doctorData?.consultationFee) {
    logger.warn(
      'initializeConsultation: Doctor consultation fee not found in database',
      {
        doctorId,
        doctorData
      }
    )
    return res.status(404).json({
      error: 'Doctor consultation fee not found',
      success: false,
      doctorData
    })
  }
  const email = patientData.email
  const fullName = patientData.fullName?.trim()
  const firstName = fullName?.split(' ')[0] || ''
  const lastName = fullName?.split(' ')[1] || ''

  const consultationFee = chargesService.calculateConsultationFee(
    Number(doctorData.consultationFee)
  )
  const metadata = {
    consultation: {
      patientId,
      doctorId,
      date,
      time,
      patientSymptoms,
      consultationId,
      timestamp,
      consultationFee: Number(consultationFee.consultationFee),
      medviveFee: Number(consultationFee.medviveFee),
      currency: 'NGN'
    }
  }
  const orderId = uuidv4()

  const callbackUrl   = `${process.env.BASE_URL}/v1/api/consultation/call-back?consultationId=${consultationId}`
  const requestData = {
    amount: Number(consultationFee.total),
    currency: 'NGN',
    orderId,
    description: `${fullName} Consultation Payment  with Dr. ${doctorData.fullName}`,
    callbackUrl,
    customer: {
      email,
      firstName,
      phone: patientData.phoneNumber || patientData.mobilenumber || '',
      lastName,
      metadata
    }
  }

  const result = await alatPayService.generateVirtualAccount(requestData)

  // Create transaction record in Firebase
  const transactionData = {
    orderId,
    consultationId,
    patientId,
    doctorId,
    amount: Number(consultationFee.total),
    consultationFee: Number(consultationFee.consultationFee),
    medviveFee: Number(consultationFee.medviveFee),
    currency: 'NGN',
    status: 'PENDING',
    paymentMethod: 'bank_transfer',
    virtualAccountData: result.success ? result.data : null,
    transactionId: result?.data?.transactionId,
    consultationDetails: {
      date,
      time,
      patientSymptoms
    },
    createdAt: timestamp,
    updatedAt: timestamp
  }

  try {
    // Save transaction to Firebase
    await createDBAdmin(
      'consultation-transactions',
      transactionData?.transactionId as string,
      transactionData
    )
    logger.info('Transaction record created in Firebase', {
      orderId,
      consultationId,
      transactionStatus: 'pending'
    })
  } catch (firebaseError) {
    logger.error('Failed to save transaction to Firebase', {
      orderId,
      consultationId,
      error: firebaseError
    })
    // Continue with the response even if Firebase save fails
  }

  if (result.success) {
    logger.info('Virtual account generated successfully', {
      orderId: requestData.orderId,
      virtualAccountNumber: result.data?.virtualAccountNumber
    })

    return res.status(200).json({
      success: true,
      requestData,
      patientId,
      doctorId,
      data: {
        patientId,
        doctorId,
        metadata: metadata.consultation,
        transactionId: orderId,
        ...result.data
      }
    })
  } else {
    // Update transaction status to failed in Firebase
    try {
      await createDBAdmin('consultation-transactions', orderId, {
        ...transactionData,
        status: 'failed',
        error: result.error,
        updatedAt: new Date().toISOString()
      })
    } catch (firebaseError) {
      logger.error('Failed to update failed transaction in Firebase', {
        orderId,
        error: firebaseError
      })
    }

    logger.error('Virtual account generation failed', {
      orderId: requestData.orderId,
      error: result.error
    })

    return res.status(400).json({
      success: false,
      message: result.error || 'Failed to generate virtual account'
    })
  }
})

export const checkConsultationPaymentStatus = asyncWrapper(async (req, res) => {
  const { transactionId } = req.params
  const requestId = Math.random().toString(36).substring(7)

  logger.info('Transaction status confirmation request initiated', {
    requestId,
    transactionId,
    timestamp: new Date().toISOString()
  })

  // Validate transaction ID
  if (
    !transactionId ||
    typeof transactionId !== 'string' ||
    transactionId.trim().length === 0
  ) {
    logger.warn(
      'Transaction status confirmation failed - invalid transaction ID',
      {
        requestId,
        transactionId,
        providedType: typeof transactionId
      }
    )
    return res.status(400).json({
      success: false,
      message: 'Valid transaction ID is required',
      requestId
    })
  }

  /// check if transaction exists in firebase
  const transactionRecord = await getDBAdmin(
    'consultation-transactions',
    transactionId
  )

  if (!transactionRecord.data) {
    logger.warn(
      'Transaction status confirmation failed - transaction not found',
      {
        requestId,
        transactionId
      }
    )
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
      requestId
    })
  }
  const transactionData = transactionRecord.data

  // Check if transaction is already processed
  if (transactionData.status !== 'PENDING') {
    logger.info('Transaction status is already processed', {
      requestId,
      transactionId,
      status: transactionData.status
    })
    return res.status(200).json({
      success: true,
      message: 'Transaction status is already processed',
      requestId,
      data: transactionData
    })
  }

  try {
    // Call AlertPay service to confirm transaction status
    logger.debug('Calling AlertPay service for transaction status', {
      requestId,
      transactionId: transactionId.trim()
    })

    const result = await alatPayService.confirmTransactionStatus(
      transactionId.trim()
    )

    if (result.success) {
      // Update Firebase transaction record with the latest status
      const updateData = {
        status: result.data?.status.toUpperCase() || 'COMPLETED',
        paymentConfirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        alertPayResponse: result.data
      }

      const consultationService = new ConsultationService({
        patientId: transactionData.patientId,
        doctorId: transactionData.doctorId
      })

      const consultation = await consultationService.bookNewConsultation({
        date: transactionData.consultationDetails.date,
        time: transactionData.consultationDetails.time,
        patientSymptoms: transactionData.consultationDetails.patientSymptoms,
        consultationId: transactionData.consultationId
      })

      try {
        await updateDBAdmin(
          'consultation-transactions',
          transactionId,
          updateData
        )
        logger.info('Firebase transaction record updated successfully', {
          requestId,
          transactionId,
          newStatus: result.data?.status,
          timestamp: new Date().toISOString()
        })
      } catch (firebaseError) {
        logger.error('Failed to update Firebase transaction record', {
          requestId,
          transactionId,
          error: firebaseError,
          timestamp: new Date().toISOString()
        })
        // Continue with response even if Firebase update fails
      }

      logger.info('Transaction status retrieved successfully', {
        requestId,
        transactionId,
        status: result.data?.status,
        timestamp: new Date().toISOString()
      })

      return res.status(200).json({
        success: true,
        message: 'Transaction status retrieved successfully',
        data: {
          ...result.data,
          transactionRecord: {
            ...transactionData,
            ...updateData
          },
          consultation
        },
        requestId,
        timestamp: new Date().toISOString()
      })
    } else {
      // Update Firebase with failed status check
      const updateData = {
        statusCheckFailed: true,
        statusCheckError: result.error,
        lastStatusCheckAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      try {
        await updateDBAdmin(
          'consultation-transactions',
          transactionId,
          updateData
        )
        logger.info(
          'Firebase transaction record updated with failed status check',
          {
            requestId,
            transactionId,
            error: result.error
          }
        )
      } catch (firebaseError) {
        logger.error('Failed to update Firebase with status check failure', {
          requestId,
          transactionId,
          error: firebaseError
        })
      }

      logger.warn('AlertPay service returned error for transaction status', {
        requestId,
        transactionId,
        error: result.error,
        timestamp: new Date().toISOString()
      })

      // if (result.error?.includes("We're confirming your transaction...Kindly reach out to your merchant if this process exceeds 30 minutes.")) {
      return res.status(400).json({
        success: false,
        message:
          'Your transaction is being processed. If payment was completed, please wait a few minutes and check again. If no payment was made, please complete your payment to proceed.',
             error:
          'Your transaction is being processed. If payment was completed, please wait a few minutes and check again. If no payment was made, please complete your payment to proceed.',
        requestId,
        timestamp: new Date().toISOString()
      })
      // }
      // return res.status(400).json({
      //   success: false,
      //   message: result.error || 'Failed to retrieve transaction status',
      //   requestId,
      //   timestamp: new Date().toISOString()
      // })
    }
  } catch (error: any) {
    // Update Firebase with system error
    const updateData = {
      systemError: true,
      systemErrorMessage: error.message,
      systemErrorAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    try {
      await updateDBAdmin(
        'consultation-transactions',
        transactionId,
        updateData
      )
      logger.info('Firebase transaction record updated with system error', {
        requestId,
        transactionId,
        error: error.message
      })
    } catch (firebaseError) {
      logger.error('Failed to update Firebase with system error', {
        requestId,
        transactionId,
        originalError: error.message,
        firebaseError: firebaseError
      })
    }

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





export const consultationPaymentCallback = asyncWrapper(async (req, res) => {
  const requestId = req.headers['x-request-id'] || 'unknown'
  
  logger.info('Consultation payment callback received', {
    requestId,
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  })

  try {
    logger.info('Processing consultation payment callback', {
      requestId,
      timestamp: new Date().toISOString()
    })

    // TODO: Implement callback processing logic

    logger.info('Consultation payment callback processed successfully', {
      requestId,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    logger.error('Error processing consultation payment callback', {
      requestId,
      error: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })

    return res.status(500).json({
      success: false,
      error: 'Internal server error processing payment callback',
      requestId,
      timestamp: new Date().toISOString()
    })
  }
})
