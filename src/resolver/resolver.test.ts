import { describe, expect, it } from 'vitest';

import { AppScope } from '../scopes/app-scope.js';
import { Scope } from '../scopes/scope.js';
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

let registrations = 0;
const registerAll = (): void => {
  registrations += 1;
  Resolver.register(Greeter, (scope) => {
    if (!(scope instanceof TenantScope)) {
      throw new Error('Expected a TenantScope');
    }
    return new Greeter(scope.tenantId);
  });
};

describe('Resolver', () => {
  it('builds a registered class from the scope it was created with', async () => {
    const resolver = new Resolver(
      new TenantScope(new AppScope(), 7),
      registerAll,
    );
    const greeter = await resolver.resolve(Greeter);
    expect(greeter).toBeInstanceOf(Greeter);
    expect(greeter.tenantId).toBe(7);
  });

  it('returns the same instance within one resolver', async () => {
    const resolver = new Resolver(
      new TenantScope(new AppScope(), 1),
      registerAll,
    );
    expect(await resolver.resolve(Greeter)).toBe(
      await resolver.resolve(Greeter),
    );
  });

  it('returns a new instance for each resolver', async () => {
    const appScope = new AppScope();
    const first = new Resolver(new TenantScope(appScope, 1), registerAll);
    const second = new Resolver(new TenantScope(appScope, 2), registerAll);
    expect(await first.resolve(Greeter)).not.toBe(
      await second.resolve(Greeter),
    );
  });

  it('runs the registration callback only once', async () => {
    await new Resolver(new TenantScope(new AppScope(), 1), registerAll).resolve(
      Greeter,
    );
    await new Resolver(new TenantScope(new AppScope(), 2), registerAll).resolve(
      Greeter,
    );
    expect(registrations).toBe(1);
  });

  it('rejects a class without a registration', async () => {
    const resolver = new Resolver(
      new TenantScope(new AppScope(), 0),
      registerAll,
    );
    await expect(resolver.resolve(Unregistered)).rejects.toThrow(
      'No provider found for Unregistered',
    );
  });
});
