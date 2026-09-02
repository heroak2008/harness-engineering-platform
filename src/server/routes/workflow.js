import express from 'express';
import Workflow from '../models/Workflow.js';
import Asset from '../models/Asset.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// 节点（原子执行单元）绑定的资产必须来自 Workflow 资产池
const nodeAssetsBelongToWorkflow = (workflow, assets = []) => {
  const workflowAssetIds = new Set(
    workflow.assets
      .map(asset => asset.assetId?.toString())
      .filter(Boolean)
  );
  return assets.every(asset =>
    asset.assetId && workflowAssetIds.has(asset.assetId.toString())
  );
};

// Command 约束：对应 Claude Code TUI 中的 slash command（/xxx），
// 参数为扁平的位置参数契约，key 顺序即 TUI 调用时的参数顺序。
const COMMAND_NAME_PATTERN = /^\/[a-z0-9][a-z0-9-]*$/;
const PARAM_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

const validateCommandPayload = (body) => {
  if (!body.name || !COMMAND_NAME_PATTERN.test(body.name)) {
    return 'Command 名称必须形如 /xxx，仅含小写字母、数字和连字符';
  }
  const parameters = body.parameters || {};
  if (
    typeof parameters !== 'object' || Array.isArray(parameters) ||
    Object.entries(parameters).some(([key, value]) =>
      !PARAM_KEY_PATTERN.test(key) || typeof value !== 'string'
    )
  ) {
    return '参数定义必须是扁平 JSON 对象，key 为参数名、value 为类型说明字符串';
  }
  return null;
};

const populateWorkflow = (query) => query
  .populate('scenarioId', 'name code level')
  .populate('assets.assetId', 'name assetType status version description')
  .populate('stages.steps.assets.assetId', 'name assetType status version');

// Get all workflows
router.get('/', async (req, res) => {
  try {
    const query = req.query.scenarioId ? { scenarioId: req.query.scenarioId } : {};
    const workflows = await populateWorkflow(Workflow.find(query)).sort({ createdAt: -1 });
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get workflow by ID
router.get('/:id', async (req, res) => {
  try {
    const workflow = await populateWorkflow(Workflow.findById(req.params.id));
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new workflow（一个业务场景只允许关联一个 Workflow，对应一个 Extension）
router.post('/', async (req, res) => {
  try {
    if (req.body.scenarioId) {
      const existing = await Workflow.findOne({ scenarioId: req.body.scenarioId });
      if (existing) {
        return res.status(409).json({
          error: '该业务场景已关联 Workflow，一个场景对应一个 Harness Workflow'
        });
      }
    }
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

// Replace the Agent/Skill pool available to this workflow
router.put('/:id/assets', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const assetIds = [...new Set(req.body.assetIds || [])];
    const assets = await Asset.find({
      _id: { $in: assetIds },
      assetType: { $in: ['Agent', 'Skill'] }
    });
    if (assets.length !== assetIds.length) {
      return res.status(400).json({ error: 'One or more Agent/Skill assets were not found' });
    }

    const selectedIds = new Set(assets.map(asset => asset._id.toString()));
    workflow.assets = assets.map(asset => ({
      assetId: asset._id,
      type: asset.assetType,
      version: asset.version,
      role: 'workflow-resource'
    }));
    // 被移出资产池的资产，级联解除所有环节下节点的绑定
    workflow.stages.forEach(stage => {
      (stage.steps || []).forEach(step => {
        step.assets = step.assets.filter(item =>
          item.assetId && selectedIds.has(item.assetId.toString())
        );
      });
    });
    workflow.updatedAt = new Date();
    await workflow.save();
    await workflow.populate('assets.assetId', 'name assetType status version description');

    res.json(workflow.assets);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add a command entry to the workflow
router.post('/:id/commands', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    const validationError = validateCommandPayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    if (workflow.commands.some(item => item.name === req.body.name)) {
      return res.status(409).json({ error: 'Command name already exists in this workflow' });
    }

    const command = {
      id: uuidv4(),
      name: req.body.name,
      description: req.body.description,
      parameters: req.body.parameters || {},
      bodyOverride: req.body.bodyOverride || ''
    };
    workflow.commands.push(command);
    workflow.updatedAt = new Date();
    await workflow.save();

    res.status(201).json(workflow.commands[workflow.commands.length - 1]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/commands/:commandId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const command = workflow.commands.find(item => item.id === req.params.commandId);
    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }
    const validationError = validateCommandPayload({ ...command.toObject(), ...req.body });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    if (
      req.body.name &&
      req.body.name !== command.name &&
      workflow.commands.some(item => item.name === req.body.name)
    ) {
      return res.status(409).json({ error: 'Command name already exists in this workflow' });
    }
    Object.assign(command, req.body);
    workflow.updatedAt = new Date();
    await workflow.save();
    res.json(command);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id/commands/:commandId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const commandExists = workflow.commands.some(item => item.id === req.params.commandId);
    if (!commandExists) {
      return res.status(404).json({ error: 'Command not found' });
    }
    workflow.commands = workflow.commands.filter(item => item.id !== req.params.commandId);
    workflow.updatedAt = new Date();
    await workflow.save();
    res.json({ message: 'Command deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- 环节（Stage，逻辑分组） ----

// Add stage to workflow
router.post('/:id/stages', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const stage = {
      id: uuidv4(),
      order: workflow.stages.length,
      name: req.body.name,
      type: req.body.type,
      description: req.body.description,
      steps: []
    };

    workflow.stages.push(stage);
    await workflow.save();

    res.status(201).json(stage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update stage（仅环节本身的名称/类型/说明/排序，节点走 steps 子路由）
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

    ['name', 'type', 'description', 'order'].forEach(field => {
      if (req.body[field] !== undefined) stage[field] = req.body[field];
    });
    await workflow.save();

    res.json(stage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete stage（级联删除环节内的节点，前端需先确认）
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

// ---- 节点（Step，原子执行单元，绑定 Agent/Skill） ----

// Add step to stage
router.post('/:id/stages/:stageId/steps', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    const stage = workflow.stages.find(s => s.id === req.params.stageId);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    if (!nodeAssetsBelongToWorkflow(workflow, req.body.assets)) {
      return res.status(400).json({
        error: 'Step assets must be selected from the workflow asset pool'
      });
    }

    const step = {
      id: uuidv4(),
      order: stage.steps.length,
      name: req.body.name,
      description: req.body.description,
      assets: req.body.assets || []
    };
    stage.steps.push(step);
    await workflow.save();

    res.status(201).json(step);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update step
router.put('/:id/stages/:stageId/steps/:stepId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    const stage = workflow.stages.find(s => s.id === req.params.stageId);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }
    const step = stage.steps.find(s => s.id === req.params.stepId);
    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }
    if (req.body.assets && !nodeAssetsBelongToWorkflow(workflow, req.body.assets)) {
      return res.status(400).json({
        error: 'Step assets must be selected from the workflow asset pool'
      });
    }

    ['name', 'description', 'order', 'assets'].forEach(field => {
      if (req.body[field] !== undefined) step[field] = req.body[field];
    });
    await workflow.save();

    res.json(step);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete step
router.delete('/:id/stages/:stageId/steps/:stepId', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    const stage = workflow.stages.find(s => s.id === req.params.stageId);
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    stage.steps = stage.steps.filter(s => s.id !== req.params.stepId);
    await workflow.save();

    res.json({ message: 'Step deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
