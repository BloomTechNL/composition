/* eslint-disable @typescript-eslint/no-explicit-any   */
/* eslint-disable @typescript-eslint/no-unsafe-function-type   */

import type { IScope } from '../scopes/scope.js';

type Factory<T> = (scope: IScope) => T;

export class Resolver {
  private static registry = new Map<Function, Factory<any>>();
  private static registered = false;
  private instances = new Map<Function, any>();

  private readonly scope: IScope;
  private readonly registerAll: () => void;

  constructor(scope: IScope, registerAll: () => void) {
    this.scope = scope;
    this.registerAll = registerAll;
  }

  static register<T>(
    token: new (...args: any[]) => T,
    factory: Factory<T>,
  ): void {
    this.registry.set(token, factory);
  }

  async resolve<T>(token: new (...args: any[]) => T): Promise<T> {
    if (!Resolver.registered) {
      this.registerAll();
      Resolver.registered = true;
    }
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }

    const factory = Resolver.registry.get(token);
    if (!factory) {
      throw new Error(`No provider found for ${token.name}`);
    }

    const instance = factory(this.scope) as T;
    this.instances.set(token, instance);
    return instance;
  }
}
