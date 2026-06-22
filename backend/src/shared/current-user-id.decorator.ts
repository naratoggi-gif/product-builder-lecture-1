import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

interface JwtPayload {
  sub: number;
  email: string;
}

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const userId = request.user?.sub;
    if (!Number.isInteger(userId) || (userId ?? 0) <= 0) {
      throw new UnauthorizedException('Authenticated user not found.');
    }
    return userId as number;
  },
);
