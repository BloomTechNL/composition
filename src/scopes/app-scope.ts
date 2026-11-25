import { Scope } from './scope.js';

export class AppScope extends Scope {
  public static instance: AppScope = new AppScope();

  protected readonly nominalTypeBrand = 'AppScope';
}
