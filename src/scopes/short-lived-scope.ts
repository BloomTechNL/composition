import type { AppScope } from './app-scope.js';
import type { IScope } from './scope.js';

export interface ShortLivedScope<TContext = undefined> extends IScope {
  readonly appScope: AppScope;
  readonly context: TContext;
}
