import mongoose from 'mongoose';

const testingCaseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  testType: {
    type: String,
    enum: ['unit', 'integration', 'e2e', 'performance', 'security', 'regression'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft'
  },
  targetAsset: {
    assetId: mongoose.Schema.Types.ObjectId,
    assetName: String,
    assetType: String
  },
  testCases: [{
    caseId: String,
    name: String,
    input: mongoose.Schema.Types.Mixed,
    expectedOutput: mongoose.Schema.Types.Mixed,
    assertion: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  }],
  qualityGates: [{
    metricName: String,
    operator: {
      type: String,
      enum: ['>', '<', '>=', '<=', '==', '!='],
      default: '>='
    },
    threshold: Number,
    severity: {
      type: String,
      enum: ['warning', 'critical'],
      default: 'critical'
    }
  }],
  executionRecords: [{
    executionId: String,
    executedAt: Date,
    status: String,
    totalCases: Number,
    passedCases: Number,
    failedCases: Number,
    skippedCases: Number,
    duration: Number,
    results: [
      {
        caseId: String,
        status: String,
        actualOutput: mongoose.Schema.Types.Mixed,
        errorMessage: String,
        executionTime: Number
      }
    ],
    qualityMetrics: {
      passRate: Number,
      coverageRate: Number,
      performanceScore: Number,
      overallScore: Number
    },
    report: String // URL or content
  }],
  automation: {
    enabled: Boolean,
    frequency: String, // cron expression
    triggeredBy: [String] // 'commit', 'workflow', 'manual'
  },
  creator: mongoose.Schema.Types.ObjectId,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('TestingCase', testingCaseSchema);
