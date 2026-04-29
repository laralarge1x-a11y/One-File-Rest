import { Router } from 'express';

const router = Router();

// Placeholder routes
router.get('/', (req, res) => res.json([]));
router.post('/', (req, res) => res.status(201).json({}));

export default router;
