import { AppScope } from './app-scope.js';
import { Scope } from './scope.js';
import type { ShortLivedScope } from './short-lived-scope.js';

export class RequestScope<TContext = undefined>
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

  public static create(): RequestScope;
  public static create<TContext>(context: TContext): RequestScope<TContext>;
  public static create(context?: unknown): RequestScope<unknown> {
    return new RequestScope(AppScope.instance, context);
  }
}
