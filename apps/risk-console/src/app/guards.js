import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '@pnc/risk/data-access';
/** Deny by default: unauthenticated users go to /login with a return URL. */
export const authGuard = (_r, state) => {
  const auth = inject(AuthStore);
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
/** Route-level permission check. The BFF enforces the same matrix, so the UI guard is a convenience, not the control. */
export const permissionGuard = (permission) => () => {
  const auth = inject(AuthStore);
  return auth.can(permission) ? true : inject(Router).createUrlTree(['/forbidden']);
};
