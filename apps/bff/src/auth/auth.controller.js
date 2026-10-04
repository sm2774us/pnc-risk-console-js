import { __decorate, __param } from 'tslib';
import { Body, Controller, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { AuthService, Public } from './auth';
const LoginBody = z.object({ persona: z.string().min(1).max(40) }).strict();
let AuthController = class AuthController {
  auth;
  constructor(auth) {
    this.auth = auth;
  }
  login(body) {
    return this.auth.demoLogin(LoginBody.parse(body).persona);
  }
  me(req) {
    return req.user;
  }
};
__decorate([Public(), Post('demo-login'), HttpCode(200), __param(0, Body())], AuthController.prototype, 'login', null);
__decorate([Get('me'), __param(0, Req())], AuthController.prototype, 'me', null);
AuthController = __decorate([Controller('auth'), __param(0, Inject(AuthService))], AuthController);
export { AuthController };
