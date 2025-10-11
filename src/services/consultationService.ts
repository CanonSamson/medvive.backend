import { v4 as uuidv4 } from 'uuid'
import {
  createDBAdmin,
  updateDBAdmin,
  getDBAdmin
} from '../utils/firebase/admin-database.js'
import logger from '../utils/logger.js'

export class ConsultationService {
  private patientId: string
  private doctorId: string

  constructor ({
    patientId,
    doctorId
  }: {
    patientId: string
    doctorId?: string
  }) {
    this.patientId = patientId
    this.doctorId = doctorId || ''
  }

  async bookNewConsultation ({
    date,
    time,
    patientSymptoms,
    consultationId: consultationId = uuidv4()
  }: {
    date: string
    time: string
    patientSymptoms?: {
      symptoms: string[]
      otherSymptoms: string
      duration: string
      moreDetails: string
    }
    consultationId?: string
  }) {
    const timestamp = new Date().toISOString()

    logger.info('Starting new consultation booking', {
      consultationId,
      patientId: this.patientId,
      doctorId: this.doctorId,
      date,
      time,
      hasSymptoms: !!patientSymptoms,
      timestamp
    })

    try {
      await createDBAdmin('consultations', consultationId, {
        date: date.toString(),
        time: time,
        consultatedAt: timestamp,
        patientId: this.patientId,
        doctorId: this.doctorId,
        active: true,
        consultationId: consultationId,
        status: 'PENDING',
        symptomsDetails: patientSymptoms || {},
        seen: { [this.doctorId]: false, [this.patientId]: false }
      })

      logger.info('Consultation booking created successfully', {
        consultationId,
        patientId: this.patientId,
        doctorId: this.doctorId,
        status: 'PENDING'
      })

      return {
        consultationId,
        patientId: this.patientId,
        doctorId: this.doctorId,
        date,
        time,
        status: 'PENDING'
      }
    } catch (error) {
      logger.error('Failed to create consultation booking', {
        consultationId,
        patientId: this.patientId,
        doctorId: this.doctorId,
        error: error instanceof Error ? error.message : error,
        timestamp
      })
      throw error
    }
  }

  async cancelConsultation ({
    consultationId,
    cancelMassage = ''
  }: {
    consultationId: string
    cancelMassage?: string
  }) {
    const timestamp = new Date()
    try {
      const patient = await getDBAdmin('patients', this.patientId)
      const consultation = await getDBAdmin('consultations', consultationId)

      if (consultation.success && consultation.data) {
        const data = consultation.data
        const updatedConsultations = {
          ...data,
          status: 'CANCELED',
          active: false,
          endedAt: timestamp.toString(),
          reason: cancelMassage
        }

        await updateDBAdmin(
          'consultations',
          consultationId,
          updatedConsultations
        )

        await updateDBAdmin('patients', this.patientId, {
          canceledConsultations: (patient.data?.canceledConsultations ?? 0) + 1
        })

        return { success: true }
      } else {
        throw new Error(`Consultation with ID ${consultationId} not found`)
      }
    } catch (error) {
      console.error('Error canceling consultation:', error)
      throw error
    }
  }
}
