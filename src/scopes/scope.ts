type Factory<T> = () => T;

export class Scope {
  private readonly instances = new Map<string, unknown>();

  resolve<T>(factory: Factory<T>, key?: string): T {
    const id = factory.toString() + (key ?? '');
    if (!this.instances.has(id)) {
      this.instances.set(id, factory());
    }
    return this.instances.get(id) as T;
  }
}
