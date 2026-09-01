import express from 'express';
import Workflow from '../models/Workflow.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all workflows
router.get('/', async (req, res) => {
  try {
    const workflows = await Workflow.find().sort({ createdAt: -1 });
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get workflow by ID
router.get('/:id', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new workflow
router.post('/', async (req, res) => {
  try {
    const workflow = new Workflow({
      ...req.body,
      stages: req.body.stages || []
    });
    await workflow.save();
    res.status(201).json(workflow);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update workflow
router.put('/:id', async (req, res) => {
  try {
    const workflow = await Workflow.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(workflow);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Execute workflow
router.post('/:id/execute', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const executionId = uuidv4();
    const executionRecord = {
      executionId,
      startTime: new Date(),
      status: 'running',
      result: null
    };

    workflow.executionRecords.push(executionRecord);
    await workflow.save();

    res.json({
      executionId,
      status: 'started',
      message: 'Workflow execution started'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add stage to workflow
router.post('/:id/stages', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const stage = {
      id: uuidv4(),
      ...req.body
    };

    workflow.stages.push(stage);
    await workflow.save();

    res.status(201).json(stage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update stage
router.put('/:id/stages/:stageId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const stage = workflow.stages.find(s => s.id === req.params.stageId);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    Object.assign(stage, req.body);
    await workflow.save();

    res.json(stage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete stage
router.delete('/:id/stages/:stageId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    workflow.stages = workflow.stages.filter(s => s.id !== req.params.stageId);
    await workflow.save();

    res.json({ message: 'Stage deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
