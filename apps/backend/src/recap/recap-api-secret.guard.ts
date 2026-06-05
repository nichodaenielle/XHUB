import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class RecapApiSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = process.env.RECAP_API_SECRET || '';
    const provided = request.headers['x-api-secret'] || request.headers['x-recap-secret'];

    if (!secret || !provided || provided !== secret) {
      throw new UnauthorizedException('Invalid API secret');
    }

    return true;
  }
}
