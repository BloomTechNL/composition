import type { Scope } from '../scopes/scope.js';

export type Token<T> = new (...args: never[]) => T;
export type Provider<S extends Scope, T> = (scope: S) => T | Promise<T>;

export type Registration<S extends Scope, T = unknown> = readonly [
  Token<T>,
  Provider<S, T>,
];

export class Registry<S extends Scope> {
  private readonly registrations = new Map<
    Token<unknown>,
    Provider<S, unknown>
  >();

  constructor(registrations: readonly Registration<S>[]) {
    for (const [token, provider] of registrations) {
      if (this.registrations.has(token)) {
        throw new Error(`${token.name} is already registered`);
      }
      this.registrations.set(token, provider);
    }
  }

  async build<T>(token: Token<T>, scope: S): Promise<T> {
    const provider = this.registrations.get(token) as
      Provider<S, T> | undefined;
    if (!provider) {
      throw new Error(`No provider found for ${token.name}`);
    }
    const result = provider(scope);
    if (result instanceof Promise) {
      return result;
    }
    return result;
  }
}
