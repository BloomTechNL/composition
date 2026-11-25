import type { ShortLivedScope } from '../scopes/short-lived-scope.js';

type Factory<T, TContext> = (scope: ShortLivedScope<TContext>) => T;
type Token<T> = abstract new (...args: never[]) => T;

export class Resolver<TContext = undefined> {
  private static readonly registry = new Map<
    Token<unknown>,
    Factory<unknown, never>
  >();
  private static registered = false;
  private readonly instances = new Map<Token<unknown>, unknown>();
  private readonly requestScope: ShortLivedScope<TContext>;
  private readonly registerAll: () => void;

  constructor(
    requestScope: ShortLivedScope<TContext>,
    registerAll: () => void,
  ) {
    this.requestScope = requestScope;
    this.registerAll = registerAll;
  }

  static register<T, TContext = undefined>(
    token: Token<T>,
    factory: Factory<T, TContext>,
  ): void {
    this.registry.set(token, factory);
  }

  async resolve<T>(token: Token<T>): Promise<T> {
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

    const instance = (factory as Factory<unknown, TContext>)(
      this.requestScope,
    ) as T;
    this.instances.set(token, instance);
    return instance;
  }
}
