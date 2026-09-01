import mongoose from 'mongoose';

const workflowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  businessScenario: String,
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft'
  },
  stages: [{
    id: String,
    name: String,
    type: {
      type: String,
      enum: ['command', 'understanding', 'design', 'execution', 'verification', 'extension']
    },
    description: String,
    config: mongoose.Schema.Types.Mixed,
    requiredAssets: [{
      assetId: mongoose.Schema.Types.ObjectId,
      type: String, // Agent, Skill, MCP
      role: String
    }],
    quality: {
      metrics: [String],
      gateRules: [String],
      minScore: Number
    }
  }],
  assets: [{
    assetId: mongoose.Schema.Types.ObjectId,
    type: String,
    version: String,
    role: String
  }],
  commands: [{
    name: String,
    description: String,
    parameters: mongoose.Schema.Types.Mixed,
    handler: String
  }],
  executionRecords: [{
    executionId: String,
    startTime: Date,
    endTime: Date,
    status: String,
    result: mongoose.Schema.Types.Mixed,
    qualityScore: Number
  }],
  version: {
    type: Number,
    default: 1
  },
  createdBy: mongoose.Schema.Types.ObjectId,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Workflow', workflowSchema);
