import { Subject } from 'rxjs';
/** Successful case mutations and socket notices refresh admin counters; no periodic requests. */
export const adminDataChanges = new Subject<void>();
