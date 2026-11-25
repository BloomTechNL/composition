import { describe, expect, it } from 'vitest';

import { AppScope } from './scopes/app-scope.js';
import { Scope } from './scopes/scope.js';

class RequestScope extends Scope {
  public readonly appScope: AppScope;

  constructor(appScope: AppScope) {
    super();
    this.appScope = appScope;
  }
}

class MyDependency {
  public readonly createdAt: number = Date.now();
}

class MyTestHandler {
  public readonly dependency: MyDependency;

  constructor(dependency: MyDependency) {
    this.dependency = dependency;
  }
}

function myTestHandler(scope: RequestScope): MyTestHandler {
  return scope.resolve(() => new MyTestHandler(myDependency(scope.appScope)));
}

function myDependency(scope: AppScope): MyDependency {
  return scope.resolve(() => new MyDependency());
}

describe('The composition root', () => {
  it('Instantiates dependencies with the right type', () => {
    const appScope = new AppScope();
    const scope = new RequestScope(appScope);
    const dependency = myTestHandler(scope);
    expect(dependency).toBeInstanceOf(MyTestHandler);
  });

  it('uses the same app scope dependencies between different requests', () => {
    const appScope = new AppScope();
    const requestScope = new RequestScope(appScope);
    const otherRequestScope = new RequestScope(appScope);
    const handler = myTestHandler(requestScope);
    const otherHandler = myTestHandler(otherRequestScope);
    expect(handler.dependency).toBe(otherHandler.dependency);
    expect(handler).not.toBe(otherHandler);
  });

  it('uses the same dependency within request scope', () => {
    const scope = new RequestScope(new AppScope());
    const handler = myTestHandler(scope);
    const otherHandler = myTestHandler(scope);
    expect(handler).toBe(otherHandler);
  });
});
