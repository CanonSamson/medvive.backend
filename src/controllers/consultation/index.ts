import { Request, Response } from 'express'
import { getDBAdmin } from '../../utils/firebase/admin-database.js'
import logger from '../../utils/logger.js'
import moment from 'moment'
import 'moment-timezone'
import { sendEmail } from '../../services/emailService.js'

// Nigeria timezone constant
const NIGERIA_TIMEZONE = 'Africa/Lagos'

// Time slot type for responses
interface TimeSlot {
  value: string
  label: string
  disabled: boolean
  isPast: boolean
  ariaLabel: string
  ariaHidden?: boolean
}

// Helper: convert to Nigeria timezone (used for safety and logging)
const convertToNigeriaTimezone = (
  date: Date | string,
  format?: string
): string => {
  try {
    const momentDate = moment(date)
    if (!momentDate.isValid()) {
      logger.warn('convertToNigeriaTimezone: Invalid date provided', { date })
      return moment()
        .tz(NIGERIA_TIMEZONE)
        .format(format || 'YYYY-MM-DD HH:mm:ss')
    }
    return momentDate
      .tz(NIGERIA_TIMEZONE)
      .format(format || 'YYYY-MM-DD HH:mm:ss')
  } catch (error) {
    logger.error('convertToNigeriaTimezone: Error converting date', {
      date,
      error: error instanceof Error ? error.message : String(error)
    })
    return moment()
      .tz(NIGERIA_TIMEZONE)
      .format(format || 'YYYY-MM-DD HH:mm:ss')
  }
}

export const getDoctorAvailability = async (req: Request, res: Response) => {
  const { doctorId } = req.params
  const { date } = req.query
  const requestId = req.headers['x-request-id'] || 'unknown'

  logger.info('getDoctorAvailability: Fetching doctor availability', {
    requestId,
    doctorId,
    date
  })

  try {
    // Fetch doctor data from Firebase
    const doctorRecord = await getDBAdmin('doctors', doctorId)

    if (!doctorRecord?.data) {
      logger.warn('getDoctorAvailability: Doctor not found', {
        requestId,
        doctorId
      })
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      })
    }

    const doctorData = doctorRecord.data
    const doctorAvailableSlots = doctorData.availableSlots || {}

    logger.debug('getDoctorAvailability: Doctor data retrieved', {
      requestId,
      doctorId,
      hasAvailability: Object.keys(doctorAvailableSlots).length > 0
    })

    // Generate date options for the next 7 days
    const dateOptions = generateDateOptions(doctorAvailableSlots)

    // If a specific date was provided, generate time slots for that date
    const { availableSlots: timeSlots, unavailableSlots } = date
      ? generateAvailableTimeSlots(date as string, doctorAvailableSlots)
      : { availableSlots: [], unavailableSlots: [] }

    logger.info('getDoctorAvailability: Successfully generated availability', {
      requestId,
      doctorId,
      dateOptionsCount: dateOptions.length,
      timeSlotsCount: timeSlots.length,
      unavailableSlotsCount: unavailableSlots.length
    })

    const response = {
      success: true,
      data: {
        dateOptions,
        timeSlots,
        unavailableSlots, // hidden/disabled slots with ARIA metadata
        doctorName: doctorData.fullName || doctorData.name || 'Doctor',
        timezone: NIGERIA_TIMEZONE
      }
    }
    console.log(JSON.stringify(response))
    return res.status(200).json(response)
  } catch (error) {
    logger.error('getDoctorAvailability: Error fetching doctor availability', {
      requestId,
      doctorId,
      error: error instanceof Error ? error.message : String(error)
    })

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch doctor availability'
    })
  }
}

// Unit-testable helper: Compare slot time with "now" in Nigeria timezone
export const isPastSlotForDate = (
  selectedDate: moment.Moment,
  slotMinutesFromMidnight: number,
  now: moment.Moment
): boolean => {
  const isSameDay =
    selectedDate.format('YYYY-MM-DD') === now.format('YYYY-MM-DD')
  if (!isSameDay) return false
  const nowMinutes = now.hours() * 60 + now.minutes()
  return slotMinutesFromMidnight <= nowMinutes
}

// Generate available and unavailable time slots based on doctor's availability for selected date
const generateAvailableTimeSlots = (
  selectedDate: string,
  doctorAvailableSlots: any
): { availableSlots: TimeSlot[]; unavailableSlots: TimeSlot[] } => {
  if (!selectedDate || !doctorAvailableSlots) {
    return { availableSlots: [], unavailableSlots: [] }
  }

  // Get the day name from the selected date using moment with Nigeria timezone
  const date = moment(selectedDate).tz(NIGERIA_TIMEZONE)
  const dayName = date.format('dddd') // Get day name in Nigeria timezone

  // Get the doctor's available slots for this day
  const daySlots = doctorAvailableSlots[dayName] || []

  if (daySlots.length === 0) {
    return { availableSlots: [], unavailableSlots: [] }
  }

  // Get current date and time for comparison in Nigeria timezone
  const now = moment().tz(NIGERIA_TIMEZONE)

  // Generate time slots based on doctor's availability
  const availableSlots: TimeSlot[] = []
  const pastSlots: TimeSlot[] = [] // Store past slots for visual feedback and accessibility

  for (const slot of daySlots) {
    const startTime = slot.startTime
    const endTime = slot.endTime

    // Convert start and end times to minutes for easier calculation
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)

    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin

    // Generate 30-minute slots within the available time range
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
      const hour = Math.floor(minutes / 60)
      const min = minutes % 60

      // Format time using moment in Nigeria timezone (display only; selected date drives comparison)
      const slotTime = moment(selectedDate)
        .tz(NIGERIA_TIMEZONE)
        .hours(hour)
        .minutes(min)
        .seconds(0)
      const time24 = slotTime.format('HH:mm')
      const slotLabel = slotTime.format('h:mm A')

      // Testable comparison: check if slot is past relative to now on the same day
      const isPast = isPastSlotForDate(date, minutes, now)

      if (isPast) {
        // Add to past slots with disabled state and accessible attributes
        pastSlots.push({
          value: time24,
          label: slotLabel,
          disabled: true,
          isPast: true,
          ariaLabel: `${slotLabel} - This time slot has already passed`,
          ariaHidden: true
        })
      } else {
        // Add to available slots
        availableSlots.push({
          value: time24,
          label: slotLabel,
          disabled: false,
          isPast: false,
          ariaLabel: `${slotLabel} - Available time slot`
        })
      }
    }
  }

  // Return future slots plus an explicit list of unavailable past slots for visual feedback
  return { availableSlots, unavailableSlots: pastSlots }
}

// Generate next 7 days for date selection, filtered by doctor availability
const generateDateOptions = (doctorAvailableSlots: any) => {
  const dates = []
  const today = moment().tz(NIGERIA_TIMEZONE)
  const now = moment().tz(NIGERIA_TIMEZONE)
  const currentHour = now.hours()
  const currentMinute = now.minutes()
  const currentTotalMinutes = currentHour * 60 + currentMinute

  for (let i = 0; i < 7; i++) {
    const date = moment(today).tz(NIGERIA_TIMEZONE).add(i, 'days')

    const dayName = date.format('dddd') // Day name in Nigeria timezone
    const monthDay = date.format('MMM D') // Month and day in Nigeria timezone
    const isoDate = date.format('YYYY-MM-DD') // ISO format date

    // Only include dates where the doctor has availability
    if (
      doctorAvailableSlots &&
      doctorAvailableSlots[dayName] &&
      doctorAvailableSlots[dayName].length > 0
    ) {
      // For today, check if all time slots have already passed
      if (i === 0) {
        // Check if all slots for today have passed
        let allSlotsPassed = true

        for (const slot of doctorAvailableSlots[dayName]) {
          const endTime = slot.endTime
          const [endHour, endMin] = endTime.split(':').map(Number)
          const endTotalMinutes = endHour * 60 + endMin

          // If at least one slot's end time is in the future, not all slots have passed
          if (endTotalMinutes > currentTotalMinutes) {
            allSlotsPassed = false
            break
          }
        }

        // Skip today if all slots have passed
        if (allSlotsPassed) {
          continue
        }
      }

      dates.push({
        value: isoDate,
        label:
          i === 0
            ? `Today, ${monthDay}`
            : i === 1
            ? `Tomorrow, ${monthDay}`
            : `${date.format('dddd')}, ${monthDay}`,
        timezone: NIGERIA_TIMEZONE
      })
    }
  }
  return dates
}

export const getDoctorTimeSlotsForDate = async (
  req: Request,
  res: Response
) => {
  const { doctorId, date } = req.params
  const requestId = req.headers['x-request-id'] || 'unknown'

  logger.info('getDoctorTimeSlotsForDate: Fetching time slots for date', {
    requestId,
    doctorId,
    date
  })

  try {
    // Fetch doctor data from Firebase
    const doctorRecord = await getDBAdmin('doctors', doctorId)

    if (!doctorRecord?.data) {
      logger.warn('getDoctorTimeSlotsForDate: Doctor not found', {
        requestId,
        doctorId
      })
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      })
    }

    const doctorData = doctorRecord.data
    const doctorAvailableSlots = doctorData.availableSlots || {}

    // Generate time slots for the specified date
    const { availableSlots: timeSlots, unavailableSlots } =
      generateAvailableTimeSlots(date, doctorAvailableSlots)

    logger.info(
      'getDoctorTimeSlotsForDate: Successfully generated time slots',
      {
        requestId,
        doctorId,
        date,
        timeSlotsCount: timeSlots.length,
        unavailableSlotsCount: unavailableSlots.length
      }
    )

    const response = {
      success: true,
      data: {
        timeSlots,
        unavailableSlots, // hidden/disabled slots with ARIA metadata
        doctorName: doctorData.fullName || doctorData.name || 'Doctor',
        date,
        timezone: NIGERIA_TIMEZONE
      }
    }
    return res.status(200).json(response)
  } catch (error) {
    logger.error('getDoctorTimeSlotsForDate: Error fetching time slots', {
      requestId,
      doctorId,
      date,
      error: error instanceof Error ? error.message : String(error)
    })

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch time slots'
    })
  }
}

// Send consultation accepted email to patient using template
export const sendConsultationAcceptedEmail = async (
  req: Request,
  res: Response
) => {
  const requestId = req.headers['x-request-id'] || 'unknown'
  try {
    const { consultationId } = req.body as { consultationId: string }

    if (!consultationId) {
      return res
        .status(400)
        .json({ success: false, error: 'consultationId is required' })
    }


    res.status(200).json({ success: true })

    // Fetch consultation details, then doctor and patient data
    const consultationRecord = await getDBAdmin('consultations', consultationId)
    if (!consultationRecord?.data) {
      return res
        .status(404)
        .json({ success: false, error: 'Consultation not found' })
    }

    const consultation = consultationRecord.data as any
    const patientRecord = await getDBAdmin('patients', consultation.patientId)
    const doctorRecord = await getDBAdmin('doctors', consultation.doctorId)

    if (!patientRecord?.data || !doctorRecord?.data) {
      return res
        .status(404)
        .json({ success: false, error: 'Doctor or patient not found' })
    }

    const patientInfo = patientRecord.data as any
    const doctorInfo = doctorRecord.data as any

    const email = patientInfo?.email || ''
    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: 'Patient email not available' })
    }

    const fullName: string = (patientInfo?.fullName || '').trim()
    const firstName = fullName?.split(' ')[0] || 'Patient'
    const doctorName = doctorInfo?.fullName || 'Doctor'
    const specialty = doctorInfo?.careerDetails?.specialty || ''
    const date = consultation?.date || ''
    const time = consultation?.time || ''
    const timezone = 'WAT'

    await sendEmail(
      email,
      `Consultation confirmed with Dr. ${doctorName || ''}`.trim(),
      'consultation-accepted',
      {
        firstName,
        doctorName,
        specialty,
        date,
        time,
        timezone,
        consultationId
      }
    )

    logger.info('sendConsultationAcceptedEmail: Email sent', {
      requestId,
      email: (email || '').replace(/(.{2}).*(@.*)/, '$1***$2'),
      consultationId
    })

  } catch (error: any) {
    logger.error('sendConsultationAcceptedEmail: Failed', {
      requestId,
      error: error?.message || String(error)
    })
    return res
      .status(500)
      .json({ success: false, error: 'Failed to send email' })
  }
}

// Send consultation started email to patient using template
export const sendConsultationStartedEmail = async (
  req: Request,
  res: Response
) => {
  const requestId = req.headers['x-request-id'] || 'unknown'
  try {
    const { consultationId } = req.body as { consultationId: string }

    if (!consultationId) {
      return res
        .status(400)
        .json({ success: false, error: 'consultationId is required' })
    }


        res.status(200).json({ success: true })

        
    // Fetch consultation, patient, and doctor data
    const consultationRecord = await getDBAdmin('consultations', consultationId)
    if (!consultationRecord?.data) {
      return res
        .status(404)
        .json({ success: false, error: 'Consultation not found' })
    }

    const consultation = consultationRecord.data as any
    const patientRecord = await getDBAdmin('patients', consultation.patientId)
    const doctorRecord = await getDBAdmin('doctors', consultation.doctorId)

    if (!patientRecord?.data || !doctorRecord?.data) {
      return res
        .status(404)
        .json({ success: false, error: 'Doctor or patient not found' })
    }

    const patientInfo = patientRecord.data as any
    const doctorInfo = doctorRecord.data as any

    const email = patientInfo?.email || ''
    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: 'Patient email not available' })
    }


    const fullName: string = (patientInfo?.fullName || '').trim()
    const firstName = fullName?.split(' ')[0] || 'Patient'
    const doctorName = doctorInfo?.fullName || 'Doctor'
    const joinLink = `${
      process.env.FRONTEND_URL || 'https://medvive.ng'
    }/patient/chats`

    await sendEmail(
      email,
      `Consultation started with Dr. ${doctorName || ''}`.trim(),
      'consultation-started',
      {
        firstName,
        doctorName,
        joinLink
      }
    )

    logger.info('sendConsultationStartedEmail: Email sent', {
      requestId,
      email: (email || '').replace(/(.{2}).*(@.*)/, '$1***$2'),
      consultationId
    })


  } catch (error: any) {
    logger.error('sendConsultationStartedEmail: Failed', {
      requestId,
      error: error?.message || String(error)
    })
    return res
      .status(500)
      .json({ success: false, error: 'Failed to send email' })
  }
}
