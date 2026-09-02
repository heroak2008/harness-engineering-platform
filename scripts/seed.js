/**
 * 开发环境示例数据脚本 (seed script)
 *
 * 用途：为本地演示/开发环境快速写入一批示例 Workflow / Asset / Spec / TestingCase 数据，
 * 便于首次运行时在控制台中看到非空的列表、图表与近期活动。
 *
 * 重要：
 * - 本脚本仅用于开发/演示环境，需手动执行 `npm run seed`。
 * - 不会在生产启动路径 (`npm start` / `src/server/index.js`) 中被自动调用。
 * - 默认会清空目标集合中已有的示例数据后重新写入，请勿在生产数据库上运行。
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import Workflow from '../src/server/models/Workflow.js';
import Asset from '../src/server/models/Asset.js';
import Spec from '../src/server/models/Spec.js';
import TestingCase from '../src/server/models/TestingCase.js';
import Scenario from '../src/server/models/Scenario.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/harness-platform';

async function seed() {
  console.log(`Connecting to ${MONGODB_URI} ...`);
  await mongoose.connect(MONGODB_URI);

  console.log('Deleting ALL existing documents from Scenario/Workflow/Asset/Spec/TestingCase collections (not just prior seed data)...');
  await Promise.all([
    Scenario.deleteMany({}),
    Workflow.deleteMany({}),
    Asset.deleteMany({}),
    Spec.deleteMany({}),
    TestingCase.deleteMany({})
  ]);

  console.log('Inserting sample business scenarios...');
  const requirementScenario = await Scenario.create({
    name: '需求开发',
    code: 'REQ-DEV',
    description: '从业务需求分析到研发交付的一级场景',
    status: 'active'
  });
  const codecScenario = await Scenario.create({
    name: '编解码开发',
    code: 'CODEC-DEV',
    description: '设计并实现协议编解码能力',
    parentId: requirementScenario._id,
    level: 2,
    status: 'active'
  });
  const reviewScenario = await Scenario.create({
    name: '代码评审',
    code: 'CODE-REVIEW',
    description: '对研发交付物进行自动化代码评审',
    parentId: requirementScenario._id,
    level: 2,
    status: 'active'
  });

  console.log('Inserting sample workflows...');
  await Workflow.create([
    {
      name: '编解码开发作业流程',
      description: '理解协议定义，设计编解码方案，生成实现并验证兼容性',
      businessScenario: '编解码开发',
      scenarioId: codecScenario._id,
      status: 'active',
      stages: [
        {
          id: 'stage-1', order: 0, name: '协议理解', type: '场景理解', description: '解析协议、字段及兼容性约束',
          steps: [
            { id: 'step-1-1', order: 0, name: '解析协议字段', description: '提取消息结构与字段定义', assets: [] },
            { id: 'step-1-2', order: 1, name: '梳理兼容性约束', description: '识别版本与兼容性要求', assets: [] }
          ]
        },
        {
          id: 'stage-2', order: 1, name: '方案设计', type: '方案设计', description: '设计编码与解码实现方案',
          steps: [
            { id: 'step-2-1', order: 0, name: '生成编解码实现', description: '调用 Agent 与 Skill 生成实现', assets: [] }
          ]
        },
        {
          id: 'stage-3', order: 2, name: '兼容性验证', type: '结果验证', description: '验证编解码结果与协议兼容性',
          steps: [
            { id: 'step-3-1', order: 0, name: '运行兼容性用例', description: '执行协议兼容性验证', assets: [] }
          ]
        }
      ]
    },
    {
      name: 'PR 代码评审辅助流程',
      description: '结合 Command 入口触发代码评审 Agent，输出评审建议',
      businessScenario: '代码评审',
      scenarioId: reviewScenario._id,
      status: 'draft',
      stages: [
        {
          id: 'stage-1', order: 0, name: '评审执行', type: '任务执行', description: '/review 命令触发后执行评审',
          steps: [
            { id: 'step-1-1', order: 0, name: '分析 PR diff', description: '调用评审 Agent 分析 diff', assets: [] },
            { id: 'step-1-2', order: 1, name: '汇总评审建议', description: '整理并输出评审报告', assets: [] }
          ]
        }
      ]
    }
  ]);

  console.log('Inserting sample assets...');
  await Asset.create([
    {
      name: '工单分类 Agent',
      description: '基于历史工单数据训练的分类 Agent，可自动识别工单类型',
      assetType: 'Agent',
      category: '客服',
      tags: ['分类', '客服'],
      status: 'published',
      marketplace: { downloads: 128, rating: 4.5, reviews: 12, freeType: 'free' }
    },
    {
      name: '代码评审 Skill',
      description: '对 PR diff 进行静态分析并给出评审意见',
      assetType: 'Skill',
      category: '研发效能',
      tags: ['代码评审'],
      status: 'published',
      marketplace: { downloads: 64, rating: 4.2, reviews: 8, freeType: 'premium' }
    },
    {
      name: '内部知识库 MCP',
      description: '提供访问企业内部知识库的 MCP 服务',
      assetType: 'MCP',
      category: '知识管理',
      tags: ['知识库'],
      status: 'draft'
    },
    {
      name: '工单派单 Extension',
      description: '将分类结果与工单系统对接，实现自动派单',
      assetType: 'Extension',
      category: '客服',
      tags: ['派单'],
      status: 'draft'
    }
  ]);

  console.log('Inserting sample specs...');
  await Spec.create([
    {
      title: '工单分类需求说明',
      description: '定义工单分类的业务需求与验收标准',
      specType: 'requirement',
      status: 'approved',
      metadata: { priority: 'high', category: '客服' }
    },
    {
      title: '工单派单接口契约',
      description: '定义派单 Extension 与工单系统之间的接口契约',
      specType: 'contract',
      status: 'review',
      metadata: { priority: 'medium', category: '客服' }
    }
  ]);

  console.log('Inserting sample testing cases...');
  await TestingCase.create([
    {
      name: '工单分类准确率评测集',
      description: '验证工单分类 Agent 在标注数据集上的准确率是否达标',
      testType: 'regression',
      status: 'active',
      testCases: [
        { caseId: 'case-1', name: '退款类工单识别', expectedOutput: '退款', assertion: 'equals' },
        { caseId: 'case-2', name: '咨询类工单识别', expectedOutput: '咨询', assertion: 'equals' }
      ],
      qualityGates: [
        { metricName: 'accuracy', operator: '>=', threshold: 90, severity: 'critical' }
      ]
    }
  ]);

  console.log('Seed data inserted successfully.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Failed to seed database:', err);
  process.exitCode = 1;
});
