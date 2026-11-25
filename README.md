# Composition

A small composition root for TypeScript.

`@bloom-group/composition` wires dependencies with plain factory functions instead of decorators or reflection. It gives you:

- **`Scope`** and **`IScope`**: the base class and interface behind every scope. A scope builds a dependency once and caches it.
- **`AppScope`**: the scope for dependencies that live as long as the process, such as database pools and configuration.
- **`Resolver`**: builds registered classes by their constructor, for code that receives a class and needs an instance.

The package ships no request or tenant scope on purpose: what "per request" means differs per application, so you define your own in a few lines (see [Adding your own scopes](#adding-your-own-scopes)).

## Installation

```bash
npm install @bloom-group/composition
```

The package is ESM-only.

## Scopes

Every scope has `resolve(factory, key?)`. The first call runs the factory and caches the result; later calls with the same factory return the cached instance. Pass a `key` to keep several instances from one factory.

```ts
import { AppScope } from '@bloom-group/composition';

const pool = AppScope.instance.resolve(() => new Pool(config));
const replica = AppScope.instance.resolve(
  () => new Pool(replicaConfig),
  'replica',
);
```

The cache key is the factory's source text, so write each factory inline in one place, typically one function per dependency.

### AppScope

`AppScope.instance` is the process-wide scope. Create `new AppScope()` in tests to get a fresh cache.

## Adding your own scopes

A scope is a cache with a lifetime. Dependencies that should live as long as the process go in `AppScope`. Dependencies that should live shorter, such as for one HTTP request, one job or one test, go in a scope you create for that lifetime and throw away afterwards. Everything resolved on it is cached until the scope is dropped, so a dependency is shared within one request but never leaks into the next.

Extend `Scope`, and add whatever that lifetime needs to know:

```ts
import { AppScope, type IScope, Scope } from '@bloom-group/composition';

export class RequestScope extends Scope {
  constructor(
    public readonly appScope: AppScope,
    public readonly tenantId: number,
  ) {
    super();
  }
}

// In your request handler:
const scope = new RequestScope(AppScope.instance, 42);
```

Two conventions make this work:

- **A short-lived scope holds a reference to the longer-lived one** (`appScope`), so its factories can reach singletons. Never the other way around: an `AppScope` dependency must not depend on a request-scoped one, because it would outlive it.
- **Per-request data lives on the scope** (`tenantId`, a user, a locale, a trace id), so factories read it from there instead of taking it as a parameter everywhere.

Add as many scopes as you have lifetimes, for example a `StartupTaskScope` for migrations or a `JobScope` for queue workers. Because factories only need the capabilities they use, you can type them against a smaller interface and let several scopes satisfy it:

```ts
interface TenantScope extends IScope {
  readonly appScope: AppScope;
  readonly tenantId: number;
}
```

## Factory functions

Write one factory function per dependency. Resolve request-scoped dependencies on the scope, and singletons on `scope.appScope`:

```ts
import type { AppScope } from '@bloom-group/composition';

export function postgresPool(scope: AppScope): Pool {
  return scope.resolve(() => new Pool(config));
}

export function flowerRepository(scope: RequestScope): FlowerRepository {
  return scope.resolve(
    () => new FlowerRepository(postgresPool(scope.appScope), scope.tenantId),
  );
}
```

## Resolver

Register a factory for each class once, then resolve classes through a `Resolver` bound to a scope. The registration callback runs on the first `resolve` in the process. Each `Resolver` caches its own instances. Factories receive the scope as an `IScope`, so narrow it to your own scope type (here with `instanceof`).

```ts
import { Resolver, type IScope } from '@bloom-group/composition';

function requestScope(scope: IScope): RequestScope {
  if (!(scope instanceof RequestScope)) {
    throw new Error('Expected a RequestScope');
  }
  return scope;
}

export function registerAllInstances(): void {
  Resolver.register(
    CreateFlower,
    (scope) => new CreateFlower(flowerRepository(requestScope(scope))),
  );
  Resolver.register(
    GetFlowers,
    (scope) => new GetFlowers(flowerRepository(requestScope(scope))),
  );
}

const resolver = new Resolver(
  new RequestScope(AppScope.instance, 42),
  registerAllInstances,
);
const handler = await resolver.resolve(CreateFlower);
```

`resolve` rejects with `No provider found for <ClassName>` when a class has no registration.

## Rules

- Use `scope.resolve()` for request-scoped dependencies and `scope.appScope.resolve()` for singletons.
- App-scoped dependencies must not depend on request-scoped ones.
- Give each class exactly one `Resolver.register()` call.
- Keep factories free of side effects other than building the instance.

## Testing

Call factory functions directly with a fresh scope:

```ts
const scope = new RequestScope(new AppScope(), 1);
const repository = flowerRepository(scope);
```

## Contributing and releases

Use `npm run deps:install` to install (it audits the frozen lockfile first and installs without lifecycle scripts), and run `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` before pushing to `main`. Releases are published from GitHub Actions with provenance: bump `version` in `package.json`, push to `main`, then run **CI and npm release** with that version. See [AGENTS.md](AGENTS.md) for the full process and settings.

## License

MIT
