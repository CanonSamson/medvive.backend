export class ChargesService {
    calculateConsultationFee(consultationFee) {
        const percent = 30;
        const medviveFee = (consultationFee * percent) / 100;
        return {
            percent,
            medviveFee,
            total: consultationFee,
            consultationFee: consultationFee - medviveFee
        };
    }
}
export const chargesService = new ChargesService();
//# sourceMappingURL=chargesService.js.map
//# sourceMappingURL=chargesService.js.map