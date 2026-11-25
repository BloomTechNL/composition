import type { Scope } from '../scopes/scope.js';
import type { Registry, Token } from './registry.js';

export class Resolver<S extends Scope> {
  private readonly scope: S;
  private readonly registry: Registry<S>;

  constructor(scope: S, registry: Registry<S>) {
    this.scope = scope;
    this.registry = registry;
  }

  async resolve<T>(token: Token<T>): Promise<T> {
    return await this.registry.build(token, this.scope);
  }
}
