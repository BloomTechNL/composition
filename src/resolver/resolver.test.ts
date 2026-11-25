import { describe, expect, it } from 'vitest';

import { AppScope } from '../scopes/app-scope.js';
import { RequestScope } from '../scopes/request-scope.js';
import type { ShortLivedScope } from '../scopes/short-lived-scope.js';
import { Resolver } from './resolver.js';

interface Tenant {
  tenantId: number;
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
  Resolver.register(
    Greeter,
    (scope: ShortLivedScope<Tenant>) => new Greeter(scope.context.tenantId),
  );
};

describe('Resolver', () => {
  it('builds a registered class from the scope it was created with', async () => {
    const resolver = new Resolver(
      new RequestScope(new AppScope(), { tenantId: 7 }),
      registerAll,
    );
    const greeter = await resolver.resolve(Greeter);
    expect(greeter).toBeInstanceOf(Greeter);
    expect(greeter.tenantId).toBe(7);
  });

  it('returns the same instance within one resolver', async () => {
    const resolver = new Resolver(
      new RequestScope(new AppScope(), { tenantId: 1 }),
      registerAll,
    );
    expect(await resolver.resolve(Greeter)).toBe(
      await resolver.resolve(Greeter),
    );
  });

  it('returns a new instance for each resolver', async () => {
    const appScope = new AppScope();
    const first = new Resolver(
      new RequestScope(appScope, { tenantId: 1 }),
      registerAll,
    );
    const second = new Resolver(
      new RequestScope(appScope, { tenantId: 2 }),
      registerAll,
    );
    expect(await first.resolve(Greeter)).not.toBe(
      await second.resolve(Greeter),
    );
  });

  it('runs the registration callback only once', async () => {
    await new Resolver(
      new RequestScope(new AppScope(), { tenantId: 1 }),
      registerAll,
    ).resolve(Greeter);
    await new Resolver(
      new RequestScope(new AppScope(), { tenantId: 2 }),
      registerAll,
    ).resolve(Greeter);
    expect(registrations).toBe(1);
  });

  it('rejects a class without a registration', async () => {
    const resolver = new Resolver(
      new RequestScope(new AppScope(), { tenantId: 0 }),
      registerAll,
    );
    await expect(resolver.resolve(Unregistered)).rejects.toThrow(
      'No provider found for Unregistered',
    );
  });
});
