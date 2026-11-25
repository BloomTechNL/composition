import { describe, expect, it } from 'vitest';

import { AppScope } from './app-scope.js';
import { RequestScope } from './request-scope.js';
import { Scope } from './scope.js';
import { StartupTaskScope } from './startup-task-scope.js';

describe('Scope', () => {
  it('calls a factory once and caches the result', () => {
    const scope = new Scope();
    let calls = 0;
    const factory = (): object => {
      calls += 1;
      return {};
    };
    expect(scope.resolve(factory)).toBe(scope.resolve(factory));
    expect(calls).toBe(1);
  });

  it('keeps separate instances for the same factory under different keys', () => {
    const scope = new Scope();
    const factory = (): object => ({});
    const first = scope.resolve(factory, 'first');
    const second = scope.resolve(factory, 'second');
    expect(first).not.toBe(second);
    expect(scope.resolve(factory, 'first')).toBe(first);
  });
});

describe.each([
  ['RequestScope', RequestScope],
  ['StartupTaskScope', StartupTaskScope],
] as const)('%s', (_name, ShortLived) => {
  it('is bound to the shared app scope', () => {
    expect(ShortLived.create().appScope).toBe(AppScope.instance);
  });

  it('exposes the context it was created with', () => {
    const context = { tenantId: 42 };
    const scope = ShortLived.create(context);
    expect(scope.context).toBe(context);
  });

  it('has an undefined context when created without one', () => {
    expect(ShortLived.create().context).toBeUndefined();
  });
});
