import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SebBrowserProofService } from '../services/seb-browser-proof.service';

export const sebProofInterceptor: HttpInterceptorFn = (req, next) => {
  const proof = inject(SebBrowserProofService);
  const headers = proof.headersFor(req.url);
  return next(Object.keys(headers).length ? req.clone({ setHeaders: headers }) : req).pipe(catchError((error: HttpErrorResponse) => {
    if (Object.keys(headers).length && (error.status === 401 || error.error?.code === 'EXAM_ENVIRONMENT_REQUIRED')) proof.clear();
    return throwError(() => error);
  }));
};
