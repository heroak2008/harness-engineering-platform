import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import Asset from '../src/server/models/Asset.js';
import Spec from '../src/server/models/Spec.js';
import TestingCase from '../src/server/models/TestingCase.js';
import Workflow from '../src/server/models/Workflow.js';
import Scenario from '../src/server/models/Scenario.js';

// These tests validate Mongoose schema rules (required fields, enums) using
// `validateSync()`, which does not require a live MongoDB connection. This
// lets us catch schema/field regressions without needing a database in CI.

describe('Asset model', () => {
  test('rejects an asset without a name or assetType', () => {
    const asset = new Asset({});
    const err = asset.validateSync();
    assert.ok(err);
    assert.ok(err.errors.name);
    assert.ok(err.errors.assetType);
  });

  test('rejects an unknown assetType', () => {
    const asset = new Asset({ name: 'demo', assetType: 'NotAType' });
    const err = asset.validateSync();
    assert.ok(err);
    assert.ok(err.errors.assetType);
  });

  test('accepts a valid Agent asset and defaults status to draft', () => {
    const asset = new Asset({ name: 'demo-agent', assetType: 'Agent' });
    const err = asset.validateSync();
    assert.equal(err, undefined);
    assert.equal(asset.status, 'draft');
    assert.equal(asset.version, '1.0.0');
  });
});

describe('Spec model', () => {
  test('rejects a spec without a title or specType', () => {
    const spec = new Spec({});
    const err = spec.validateSync();
    assert.ok(err);
    assert.ok(err.errors.title);
    assert.ok(err.errors.specType);
  });

  test('accepts a valid requirement spec and defaults status to draft', () => {
    const spec = new Spec({ title: '示例需求', specType: 'requirement' });
    const err = spec.validateSync();
    assert.equal(err, undefined);
    assert.equal(spec.status, 'draft');
    assert.equal(spec.version, 1);
  });
});

describe('TestingCase model', () => {
  test('rejects a testing case without a name or testType', () => {
    const testCase = new TestingCase({});
    const err = testCase.validateSync();
    assert.ok(err);
    assert.ok(err.errors.name);
    assert.ok(err.errors.testType);
  });

  test('accepts a valid testing case', () => {
    const testCase = new TestingCase({ name: '示例测试集', testType: 'regression' });
    const err = testCase.validateSync();
    assert.equal(err, undefined);
    assert.equal(testCase.status, 'draft');
  });
});

describe('Workflow model', () => {
  test('rejects a workflow without a name', () => {
    const workflow = new Workflow({});
    const err = workflow.validateSync();
    assert.ok(err);
    assert.ok(err.errors.name);
  });

  test('accepts a valid workflow and defaults status to draft', () => {
    const workflow = new Workflow({ name: '示例工作流' });
    const err = workflow.validateSync();
    assert.equal(err, undefined);
    assert.equal(workflow.status, 'draft');
  });

  test('requires a name for each workflow command', () => {
    const workflow = new Workflow({
      name: '示例工作流',
      commands: [{ bodyOverride: '自定义正文' }]
    });
    const err = workflow.validateSync();
    assert.ok(err);
    assert.ok(err.errors['commands.0.name']);
  });

  test('accepts stages with custom scenario-defined type labels', () => {
    // 回归防护：stages[].type 必须保持 { type: String } 写法，否则 Mongoose
    // 会把整个 stage 子文档误判为 String 类型声明（Cast to string failed）
    const workflow = new Workflow({
      name: '示例工作流',
      stages: [{
        id: 's1', order: 0, name: '协议理解', type: '流程设计',
        steps: [{ id: 'n1', order: 0, name: 'MML建模分析', assets: [] }]
      }]
    });
    const err = workflow.validateSync();
    assert.equal(err, undefined);
    assert.equal(workflow.stages[0].type, '流程设计');
    assert.equal(workflow.stages[0].steps[0].name, 'MML建模分析');
  });
});

describe('Scenario model', () => {
  test('rejects a scenario without a name', () => {
    const scenario = new Scenario({});
    const err = scenario.validateSync();
    assert.ok(err);
    assert.ok(err.errors.name);
  });

  test('accepts a hierarchical scenario and defaults status to draft', () => {
    const scenario = new Scenario({ name: '编解码开发', level: 2 });
    const err = scenario.validateSync();
    assert.equal(err, undefined);
    assert.equal(scenario.level, 2);
    assert.equal(scenario.status, 'draft');
  });
});
