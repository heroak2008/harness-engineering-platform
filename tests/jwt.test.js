import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('getJwtSecret', () => {
  test('uses JWT_SECRET when set', async () => {
    process.env.JWT_SECRET = 'a-test-secret';
    delete process.env.NODE_ENV;
    const { getJwtSecret } = await import('../src/server/utils/jwt.js');
    assert.equal(getJwtSecret(), 'a-test-secret');
    delete process.env.JWT_SECRET;
  });

  test('throws in production when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    // Re-import with a cache-busting query so module-level state from other
    // tests does not leak in, since Node ESM caches modules by resolved URL.
    const { getJwtSecret } = await import('../src/server/utils/jwt.js?case=prod');
    assert.throws(() => getJwtSecret(), /JWT_SECRET/);
    delete process.env.NODE_ENV;
  });

  test('falls back to a random secret outside production when unset', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
    const { getJwtSecret } = await import('../src/server/utils/jwt.js?case=dev');
    const secret = getJwtSecret();
    assert.equal(typeof secret, 'string');
    assert.ok(secret.length >= 32);
    // Calling again should return the same value for the lifetime of the process.
    assert.equal(getJwtSecret(), secret);
  });
});
