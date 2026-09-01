import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import Asset from '../src/server/models/Asset.js';
import Spec from '../src/server/models/Spec.js';
import TestingCase from '../src/server/models/TestingCase.js';
import Workflow from '../src/server/models/Workflow.js';

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
});
