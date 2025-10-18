import { Router } from 'express';
import { initializeConsultation } from '../controllers/consultationRoutes.js';
const router = Router();
router.post('/initialize', initializeConsultation);
export const consultationRoutes = router;
//# sourceMappingURL=consultationRoutes.js.map
//# sourceMappingURL=consultationRoutes.js.map