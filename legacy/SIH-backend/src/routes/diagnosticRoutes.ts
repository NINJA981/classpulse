import { Router } from 'express';
import { submitDiagnostic, getDiagnosticResults } from '../controllers/diagnosticController.js';

const router = Router();

router.post('/', submitDiagnostic);
router.get('/:studentId', getDiagnosticResults);

export default router;

