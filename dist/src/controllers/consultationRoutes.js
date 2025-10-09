import asyncWrapper from '../middlewares/asyncWrapper.js';
import { alatPayService } from '../services/alatPayService.js';
import { chargesService } from '../services/chargesService.js';
import { getDBAdmin } from '../utils/firebase/admin-database.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
export const initializeConsultation = asyncWrapper(async (req, res) => {
    const { patientId, doctorId, date, time, patientSymptoms } = req.body;
    const consultationId = uuidv4();
    const timestamp = new Date().toISOString();
    const patientRecord = await getDBAdmin('patients', patientId);
    const doctorRecord = await getDBAdmin('doctors', doctorId);
    if (!patientRecord?.data || !doctorRecord?.data) {
        logger.warn('initializeConsultation: Patient or Doctor not found in database', {
            patientId,
            doctorId,
            patientRecord,
            doctorRecord
        });
        return res.status(404).json({
            error: 'Patient or Doctor not found',
            success: false,
            patientRecord,
            doctorRecord
        });
    }
    const patientData = patientRecord.data;
    const doctorData = doctorRecord.data;
    if (!doctorData?.consultationFee) {
        logger.warn('initializeConsultation: Doctor consultation fee not found in database', {
            doctorId,
            doctorData
        });
        return res.status(404).json({
            error: 'Doctor consultation fee not found',
            success: false,
            doctorData
        });
    }
    const email = patientData.email;
    const fullName = patientData.fullName?.trim();
    const firstName = fullName?.split(' ')[0] || '';
    const lastName = fullName?.split(' ')[1] || '';
    const consultationFee = chargesService.calculateConsultationFee(Number(doctorData.consultationFee));
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
    };
    const orderId = uuidv4();
    const requestData = {
        amount: Number(consultationFee.total),
        currency: 'NGN',
        orderId,
        description: `${fullName} Consultation Payment  with Dr. ${doctorData.fullName}`,
        customer: {
            email,
            firstName,
            phone: patientData.phoneNumber || patientData.mobilenumber || '',
            lastName,
            metadata
        }
    };
    const result = await alatPayService.generateVirtualAccount(requestData);
    if (result.success) {
        logger.info('Virtual account generated successfully', {
            orderId: requestData.orderId,
            virtualAccountNumber: result.data?.virtualAccountNumber
        });
        return res.status(200).json({
            success: true,
            message: 'Virtual account generated successfully',
            requestData,
            data: {
                metadata: metadata.consultation,
                ...result.data
            }
        });
    }
    else {
        logger.error('Virtual account generation failed', {
            orderId: requestData.orderId,
            error: result.error
        });
        return res.status(400).json({
            success: false,
            message: result.error || 'Failed to generate virtual account'
        });
    }
});
//# sourceMappingURL=consultationRoutes.js.map