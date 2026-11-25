import { AppScope } from './app-scope.js';
import { Scope } from './scope.js';
import type { ShortLivedScope } from './short-lived-scope.js';

export class StartupTaskScope<TContext = undefined>
  extends Scope
  implements ShortLivedScope<TContext>
{
  public readonly appScope: AppScope;
  public readonly context: TContext;

  constructor(appScope: AppScope, context: TContext) {
    super();
    this.appScope = appScope;
    this.context = context;
  }

  public static create(): StartupTaskScope;
  public static create<TContext>(context: TContext): StartupTaskScope<TContext>;
  public static create(context?: unknown): StartupTaskScope<unknown> {
    return new StartupTaskScope(AppScope.instance, context);
  }
}
