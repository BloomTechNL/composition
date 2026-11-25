import { describe, expect, it } from 'vitest';

import { AppScope } from '../scopes/app-scope.js';
import { Scope } from '../scopes/scope.js';
import { Registry } from './registry.js';
import { Resolver } from './resolver.js';

class TenantScope extends Scope {
  public readonly appScope: AppScope;
  public readonly tenantId: number;

  constructor(appScope: AppScope, tenantId: number) {
    super();
    this.appScope = appScope;
    this.tenantId = tenantId;
  }
}

class Greeter {
  public readonly tenantId: number;

  constructor(tenantId: number) {
    this.tenantId = tenantId;
  }
}

class Unregistered {
  public readonly name: string = 'unregistered';
}

const registry = new Registry<TenantScope>([
  [Greeter, (scope) => scope.resolve(() => new Greeter(scope.tenantId))],
]);

describe('Resolver', () => {
  it('builds a registered class from the scope it was created with', async () => {
    const resolver = new Resolver(new TenantScope(new AppScope(), 7), registry);
    const greeter = await resolver.resolve(Greeter);
    expect(greeter).toBeInstanceOf(Greeter);
    expect(greeter.tenantId).toBe(7);
  });

  it('returns the same instance within one scope', async () => {
    const scope = new TenantScope(new AppScope(), 1);
    const first = new Resolver(scope, registry);
    const second = new Resolver(scope, registry);
    expect(await first.resolve(Greeter)).toBe(await first.resolve(Greeter));
    expect(await first.resolve(Greeter)).toBe(await second.resolve(Greeter));
  });

  it('returns a new instance for each scope', async () => {
    const appScope = new AppScope();
    const first = new Resolver(new TenantScope(appScope, 1), registry);
    const second = new Resolver(new TenantScope(appScope, 2), registry);
    expect(await first.resolve(Greeter)).not.toBe(
      await second.resolve(Greeter),
    );
  });

  it('rejects a class without a registration', async () => {
    const resolver = new Resolver(new TenantScope(new AppScope(), 0), registry);
    await expect(resolver.resolve(Unregistered)).rejects.toThrow(
      'No provider found for Unregistered',
    );
  });

  it('builds a class from an async factory', async () => {
    const asyncRegistry = new Registry<TenantScope>([
      [
        Greeter,
        async (scope) => {
          await Promise.resolve();
          return new Greeter(scope.tenantId);
        },
      ],
    ]);
    const resolver = new Resolver(
      new TenantScope(new AppScope(), 3),
      asyncRegistry,
    );
    const greeter = await resolver.resolve(Greeter);
    expect(greeter).toBeInstanceOf(Greeter);
    expect(greeter.tenantId).toBe(3);
  });

  it('runs an async factory once for concurrent resolves in one scope', async () => {
    let builds = 0;
    const asyncRegistry = new Registry<TenantScope>([
      [
        Greeter,
        (scope) =>
          scope.resolve(async () => {
            builds += 1;
            await Promise.resolve();
            return new Greeter(scope.tenantId);
          }),
      ],
    ]);
    const resolver = new Resolver(
      new TenantScope(new AppScope(), 1),
      asyncRegistry,
    );
    const [first, second] = await Promise.all([
      resolver.resolve(Greeter),
      resolver.resolve(Greeter),
    ]);
    expect(first).toBe(second);
    expect(builds).toBe(1);
  });

  it('only accepts a registry for the type of its scope', () => {
    /* eslint-disable @typescript-eslint/no-unsafe-class-instance-assignment -- these mismatches are the point of this test */
    // @ts-expect-error An AppScope is not a TenantScope.
    new Resolver(new AppScope(), registry);
    const appRegistry = new Registry<AppScope>([]);
    // @ts-expect-error A TenantScope is not an AppScope.
    new Resolver(new TenantScope(new AppScope(), 0), appRegistry);
    /* eslint-enable @typescript-eslint/no-unsafe-class-instance-assignment */
  });
});

describe('Registry', () => {
  it('rejects a second registration for the same class', () => {
    expect(
      () =>
        new Registry<TenantScope>([
          [Greeter, (scope) => new Greeter(scope.tenantId)],
          [Greeter, (scope) => new Greeter(scope.tenantId)],
        ]),
    ).toThrow('Greeter is already registered');
  });
});
