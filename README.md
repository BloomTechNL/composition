# Composition

A small composition root for TypeScript.

`@bloom-group/composition` wires dependencies with plain factory functions instead of decorators or reflection. It gives you:

- **`AppScope`**: dependencies that live as long as the process, such as database pools and configuration.
- **`RequestScope`**: dependencies that live for one request.
- **`StartupTaskScope`**: dependencies for work that runs once at startup, such as migrations.
- **`ShortLivedScope<TContext>`**: the interface both short-lived scopes implement, for factories that work in either. `TContext` is whatever per-request data you define, such as a tenant, a user or a locale.
- **`Resolver`**: builds registered classes by their constructor, for code that receives a class and needs an instance.

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

### RequestScope and StartupTaskScope

A short-lived scope holds a reference to an `AppScope` and a `context` of a type you choose. The library does not care what the context is: a tenant, a user, a locale, a trace id, or nothing at all.

```ts
import { RequestScope, StartupTaskScope } from '@bloom-group/composition';

interface Tenant {
  tenantId: number;
}

const scope = RequestScope.create<Tenant>({ tenantId: 42 });
scope.context.tenantId; // 42

// No context: TContext defaults to undefined.
const plain = RequestScope.create();
const startup = StartupTaskScope.create();
```

`create` uses `AppScope.instance`. To use another app scope, call the constructor:

```ts
const scope = new RequestScope(new AppScope(), { tenantId: 42 });
```

If you need a "platform" scope next to tenant scopes, model it in your context type, for example `{ tenantId: number } | { platform: true }`.

You can also write your own scope: implement `ShortLivedScope<TContext>` and it works with factories and `Resolver`.

## Factory functions

Write one factory function per dependency. Resolve request-scoped dependencies on the scope, and singletons on `scope.appScope`:

```ts
import type { AppScope, ShortLivedScope } from '@bloom-group/composition';

export function postgresPool(scope: AppScope): Pool {
  return scope.resolve(() => new Pool(config));
}

export function flowerRepository(
  scope: ShortLivedScope<Tenant>,
): FlowerRepository {
  return scope.resolve(
    () =>
      new FlowerRepository(
        postgresPool(scope.appScope),
        scope.context.tenantId,
      ),
  );
}
```

## Resolver

Register a factory for each class once, then resolve classes through a `Resolver` bound to a scope. The registration callback runs on the first `resolve` in the process. Each `Resolver` caches its own instances.

```ts
import { Resolver } from '@bloom-group/composition';

export function registerAllInstances(): void {
  Resolver.register(
    CreateFlower,
    (scope) => new CreateFlower(flowerRepository(scope)),
  );
  Resolver.register(
    GetFlowers,
    (scope) => new GetFlowers(flowerRepository(scope)),
  );
}

const resolver = new Resolver(
  RequestScope.create<Tenant>({ tenantId: 42 }),
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
const scope = new RequestScope(new AppScope(), { tenantId: 1 });
const repository = flowerRepository(scope);
```

## Contributing and releases

Use `npm run deps:install` to install (it audits the frozen lockfile first and installs without lifecycle scripts), and run `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` before pushing to `main`. Releases are published from GitHub Actions with provenance: bump `version` in `package.json`, push to `main`, then run **CI and npm release** with that version. See [AGENTS.md](AGENTS.md) for the full process and settings.

## License

MIT
