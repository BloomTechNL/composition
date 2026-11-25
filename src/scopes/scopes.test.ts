import { describe, expect, it } from 'vitest';

import { AppScope } from './app-scope.js';
import { Scope } from './scope.js';

describe('Scope', () => {
  it('calls a factory once and caches the result', () => {
    const scope = new Scope();
    let calls = 0;
    const factory = (): object => {
      calls += 1;
      return {};
    };
    expect(scope.resolve(factory)).toBe(scope.resolve(factory));
    expect(calls).toBe(1);
  });

  it('keeps separate instances for the same factory under different keys', () => {
    const scope = new Scope();
    const factory = (): object => ({});
    const first = scope.resolve(factory, 'first');
    const second = scope.resolve(factory, 'second');
    expect(first).not.toBe(second);
    expect(scope.resolve(factory, 'first')).toBe(first);
  });
});

describe('AppScope', () => {
  it('shares one process-wide instance', () => {
    expect(AppScope.instance).toBe(AppScope.instance);
  });

  it('caches independently from other AppScope instances', () => {
    const factory = (): object => ({});
    expect(new AppScope().resolve(factory)).not.toBe(
      new AppScope().resolve(factory),
    );
  });
});
