import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { resetGetCache } from '../interceptors/get-cache.interceptor';
@Injectable({ providedIn: 'root' })
export class CatalogChangesService {
  readonly changes = new BehaviorSubject(0);
  private last = 0;
  refresh(revision?: number) {
    if (revision !== undefined && revision === this.last) return;
    this.last = revision ?? Date.now();
    resetGetCache();
    this.changes.next(this.last);
  }
}
