import mongoose from 'mongoose';

const specSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  specType: {
    type: String,
    enum: ['requirement', 'design', 'task', 'contract', 'rule', 'standard'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'implemented', 'archived'],
    default: 'draft'
  },
  content: {
    overview: String,
    details: mongoose.Schema.Types.Mixed,
    acceptance: [String],
    rules: [String],
    examples: [String]
  },
  relationships: {
    parentSpec: mongoose.Schema.Types.ObjectId,
    relatedSpecs: [mongoose.Schema.Types.ObjectId],
    relatedWorkflows: [mongoose.Schema.Types.ObjectId],
    relatedAssets: [mongoose.Schema.Types.ObjectId]
  },
  metadata: {
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    complexity: {
      type: String,
      enum: ['simple', 'moderate', 'complex'],
      default: 'moderate'
    },
    category: String,
    tags: [String]
  },
  validation: {
    checklist: [
      {
        item: String,
        checked: Boolean,
        reviewer: mongoose.Schema.Types.ObjectId
      }
    ],
    reviewComments: [
      {
        reviewer: mongoose.Schema.Types.ObjectId,
        comment: String,
        timestamp: Date,
        status: String
      }
    ],
    approvedBy: mongoose.Schema.Types.ObjectId,
    approvalDate: Date
  },
  version: {
    type: Number,
    default: 1
  },
  history: [
    {
      version: Number,
      changes: String,
      updatedBy: mongoose.Schema.Types.ObjectId,
      updatedAt: Date
    }
  ],
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

export default mongoose.model('Spec', specSchema);
