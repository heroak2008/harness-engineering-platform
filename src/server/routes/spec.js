import express from 'express';
import Spec from '../models/Spec.js';

const router = express.Router();

// Get all specs
router.get('/', async (req, res) => {
  try {
    const { specType, status } = req.query;
    const query = {};
    if (specType) query.specType = specType;
    if (status) query.status = status;

    const specs = await Spec.find(query).sort({ createdAt: -1 });
    res.json(specs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get spec by ID
router.get('/:id', async (req, res) => {
  try {
    const spec = await Spec.findById(req.params.id);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }
    res.json(spec);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new spec
router.post('/', async (req, res) => {
  try {
    const spec = new Spec(req.body);
    await spec.save();
    res.status(201).json(spec);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update spec
router.put('/:id', async (req, res) => {
  try {
    const spec = await Spec.findById(req.params.id);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }

    // Create history record
    spec.history.push({
      version: spec.version,
      changes: req.body.changes || 'Updated',
      updatedBy: req.body.updatedBy,
      updatedAt: new Date()
    });

    spec.version += 1;
    Object.assign(spec, req.body);
    spec.updatedAt = new Date();

    await spec.save();
    res.json(spec);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Submit for review
router.post('/:id/submit-review', async (req, res) => {
  try {
    const spec = await Spec.findById(req.params.id);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }

    spec.status = 'review';
    await spec.save();

    res.json({ message: 'Spec submitted for review', spec });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add review comment
router.post('/:id/comments', async (req, res) => {
  try {
    const { comment, status } = req.body;
    const spec = await Spec.findById(req.params.id);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }

    spec.validation.reviewComments.push({
      reviewer: req.body.reviewerId,
      comment,
      timestamp: new Date(),
      status
    });

    await spec.save();
    res.json(spec);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Approve spec
router.post('/:id/approve', async (req, res) => {
  try {
    const spec = await Spec.findById(req.params.id);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found' });
    }

    spec.status = 'approved';
    spec.validation.approvedBy = req.body.approverId;
    spec.validation.approvalDate = new Date();

    await spec.save();
    res.json(spec);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
