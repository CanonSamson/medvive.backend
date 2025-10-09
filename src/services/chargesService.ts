export class ChargesService {
  calculateConsultationFee (consultationFee: number) {
    const percent = 30
    const medviveFee = (consultationFee * percent) / 100

    return {
      percent,
      medviveFee,
      total: consultationFee,
      consultationFee: consultationFee - medviveFee
    }
  }
}

export const chargesService = new ChargesService()
