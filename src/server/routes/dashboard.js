import express from 'express';
import Workflow from '../models/Workflow.js';
import Asset from '../models/Asset.js';
import Spec from '../models/Spec.js';
import TestingCase from '../models/TestingCase.js';

const router = express.Router();

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const workflows = await Workflow.countDocuments();
    const assets = await Asset.countDocuments();
    const specs = await Spec.countDocuments();
    const testCases = await TestingCase.countDocuments();

    const publishedAssets = await Asset.countDocuments({ status: 'published' });
    const approvedSpecs = await Spec.countDocuments({ status: 'approved' });
    const activeWorkflows = await Workflow.countDocuments({ status: 'active' });

    res.json({
      total: {
        workflows,
        assets,
        specs,
        testCases
      },
      published: {
        assets: publishedAssets,
        specs: approvedSpecs,
        workflows: activeWorkflows
      },
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent activities
router.get('/activities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const workflows = await Workflow.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const assets = await Asset.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const specs = await Spec.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const activities = [
      ...workflows.map(w => ({ type: 'workflow', ...w })),
      ...assets.map(a => ({ type: 'asset', ...a })),
      ...specs.map(s => ({ type: 'spec', ...s }))
    ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, limit);

    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get workflow execution statistics
router.get('/workflows/stats', async (req, res) => {
  try {
    const workflows = await Workflow.find().lean();

    const stats = {
      total: workflows.length,
      byStatus: {
        draft: workflows.filter(w => w.status === 'draft').length,
        active: workflows.filter(w => w.status === 'active').length,
        archived: workflows.filter(w => w.status === 'archived').length
      },
      totalExecutions: 0,
      successfulExecutions: 0,
      executionSuccessRate: 0
    };

    workflows.forEach(w => {
      stats.totalExecutions += w.executionRecords.length;
      stats.successfulExecutions += w.executionRecords.filter(
        e => e.status === 'success'
      ).length;
    });

    if (stats.totalExecutions > 0) {
      stats.executionSuccessRate = (stats.successfulExecutions / stats.totalExecutions) * 100;
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get asset marketplace statistics
router.get('/assets/stats', async (req, res) => {
  try {
    const assets = await Asset.find().lean();

    const stats = {
      total: assets.length,
      byType: {
        Agent: assets.filter(a => a.assetType === 'Agent').length,
        Skill: assets.filter(a => a.assetType === 'Skill').length,
        MCP: assets.filter(a => a.assetType === 'MCP').length,
        Extension: assets.filter(a => a.assetType === 'Extension').length
      },
      byStatus: {
        draft: assets.filter(a => a.status === 'draft').length,
        published: assets.filter(a => a.status === 'published').length,
        deprecated: assets.filter(a => a.status === 'deprecated').length
      },
      topDownloads: assets
        .sort((a, b) => (b.marketplace?.downloads || 0) - (a.marketplace?.downloads || 0))
        .slice(0, 5),
      topRated: assets
        .filter(a => (a.marketplace?.rating || 0) > 0)
        .sort((a, b) => (b.marketplace?.rating || 0) - (a.marketplace?.rating || 0))
        .slice(0, 5)
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get quality metrics
router.get('/quality/metrics', async (req, res) => {
  try {
    const testCases = await TestingCase.find().lean();
    const assets = await Asset.find().lean();

    const metrics = {
      testCoverage: 0,
      overallQualityScore: 0,
      executionStats: {
        total: 0,
        passed: 0,
        failed: 0
      },
      assetQuality: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0
      }
    };

    // Calculate test execution stats
    testCases.forEach(tc => {
      tc.executionRecords.forEach(record => {
        metrics.executionStats.total += 1;
        if (record.status === 'passed') {
          metrics.executionStats.passed += 1;
        } else {
          metrics.executionStats.failed += 1;
        }
      });
    });

    // Calculate asset quality distribution
    assets.forEach(a => {
      const score = a.quality?.overallScore || 0;
      if (score >= 80) metrics.assetQuality.excellent += 1;
      else if (score >= 60) metrics.assetQuality.good += 1;
      else if (score >= 40) metrics.assetQuality.fair += 1;
      else metrics.assetQuality.poor += 1;
    });

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
