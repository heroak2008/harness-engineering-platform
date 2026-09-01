import express from 'express';
import TestingCase from '../models/TestingCase.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all test cases
router.get('/', async (req, res) => {
  try {
    const { testType, status } = req.query;
    const query = {};
    if (testType) query.testType = testType;
    if (status) query.status = status;

    const cases = await TestingCase.find(query).sort({ createdAt: -1 });
    res.json(cases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get test case by ID
router.get('/:id', async (req, res) => {
  try {
    const testCase = await TestingCase.findById(req.params.id);
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    res.json(testCase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new test case
router.post('/', async (req, res) => {
  try {
    const testCase = new TestingCase(req.body);
    await testCase.save();
    res.status(201).json(testCase);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update test case
router.put('/:id', async (req, res) => {
  try {
    const testCase = await TestingCase.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    res.json(testCase);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Execute test case
router.post('/:id/execute', async (req, res) => {
  try {
    const testCase = await TestingCase.findById(req.params.id);
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }

    const executionId = uuidv4();
    const startTime = Date.now();

    // Simulate test execution
    const results = testCase.testCases.map(tc => ({
      caseId: tc.caseId,
      status: Math.random() > 0.1 ? 'passed' : 'failed',
      actualOutput: tc.expectedOutput,
      errorMessage: Math.random() > 0.1 ? null : 'Test failed',
      executionTime: Math.random() * 1000
    }));

    const passedCases = results.filter(r => r.status === 'passed').length;
    const failedCases = results.filter(r => r.status === 'failed').length;

    const executionRecord = {
      executionId,
      executedAt: new Date(),
      status: failedCases === 0 ? 'passed' : 'failed',
      totalCases: testCase.testCases.length,
      passedCases,
      failedCases,
      skippedCases: 0,
      duration: Date.now() - startTime,
      results,
      qualityMetrics: {
        passRate: (passedCases / testCase.testCases.length) * 100,
        coverageRate: 85,
        performanceScore: 90,
        overallScore: ((passedCases / testCase.testCases.length) * 100 + 85 + 90) / 3
      }
    };

    testCase.executionRecords.push(executionRecord);
    await testCase.save();

    res.json(executionRecord);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get execution history
router.get('/:id/executions', async (req, res) => {
  try {
    const testCase = await TestingCase.findById(req.params.id);
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    res.json(testCase.executionRecords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get execution report
router.get('/:id/executions/:executionId', async (req, res) => {
  try {
    const testCase = await TestingCase.findById(req.params.id);
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }

    const execution = testCase.executionRecords.find(
      e => e.executionId === req.params.executionId
    );
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json(execution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
