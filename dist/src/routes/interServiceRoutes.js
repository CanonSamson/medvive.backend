import { Router } from 'express';
import { sendEmailHandler, } from '../controllers/interServiceController.js';
const router = Router();
router.post('/email', sendEmailHandler);
export const interServiceRoutes = router;
//# sourceMappingURL=interServiceRoutes.js.map