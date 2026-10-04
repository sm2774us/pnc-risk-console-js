import { __decorate, __param } from 'tslib';
import { ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DEMO_PERSONAS, ROLE_PERMISSIONS } from '@pnc/shared/domain';
import { SignJWT, jwtVerify } from 'jose';
import { APP_ENV } from '../config/env';
export const IS_PUBLIC = 'isPublic';
export const PERMISSIONS_KEY = 'permissions';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const RequirePermissions = (...p) => SetMetadata(PERMISSIONS_KEY, p);
let AuthService = class AuthService {
  env;
  key;
  constructor(env) {
    this.env = env;
    this.key = new TextEncoder().encode(env.JWT_SECRET);
  }
  async demoLogin(sub) {
    if (this.env.AUTH_MODE !== 'demo') throw new ForbiddenException('Demo login is disabled');
    const user = DEMO_PERSONAS.find((p) => p.sub === sub);
    if (!user) throw new UnauthorizedException('Unknown persona');
    const accessToken = await new SignJWT({ name: user.name, role: user.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.sub)
      .setIssuer(this.env.JWT_ISSUER)
      .setAudience(this.env.JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.env.JWT_TTL_SEC}s`)
      .sign(this.key);
    return { accessToken, expiresIn: this.env.JWT_TTL_SEC, user };
  }
  /** Permissions are derived server-side from the role claim; token-supplied permission lists are never trusted. */
  async verify(token) {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.env.JWT_ISSUER,
        audience: this.env.JWT_AUDIENCE,
        algorithms: ['HS256'],
      });
      const role = payload['role'];
      if (!(role in ROLE_PERMISSIONS) || !payload.sub) throw new Error('bad claims');
      return { sub: payload.sub, name: String(payload['name'] ?? payload.sub), role, permissions: [...ROLE_PERMISSIONS[role]] };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
};
AuthService = __decorate([Injectable(), __param(0, Inject(APP_ENV))], AuthService);
export { AuthService };
/** Deny-by-default: every route requires a valid token unless explicitly marked @Public(). */
let AuthGuard = class AuthGuard {
  reflector;
  auth;
  constructor(reflector, auth) {
    this.reflector = reflector;
    this.auth = auth;
  }
  async canActivate(ctx) {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride(IS_PUBLIC, targets)) return true;
    const req = ctx.switchToHttp().getRequest();
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token');
    req.user = await this.auth.verify(token);
    const required = this.reflector.getAllAndOverride(PERMISSIONS_KEY, targets) ?? [];
    const missing = required.filter((p) => !req.user.permissions.includes(p));
    if (missing.length) throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    return true;
  }
};
AuthGuard = __decorate([Injectable(), __param(0, Inject(Reflector)), __param(1, Inject(AuthService))], AuthGuard);
export { AuthGuard };
