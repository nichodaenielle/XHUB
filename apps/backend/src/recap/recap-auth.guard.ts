import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { RecapService } from './recap.service';

@Injectable()
export class RecapAuthGuard {
  private readonly logger = new Logger(RecapAuthGuard.name);

  constructor(private readonly recapService: RecapService) {}

  async canActivate(context: any): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const validation = await this.recapService.validateToken(token);

      if (!validation.valid) {
        throw new UnauthorizedException('Invalid token');
      }

      // Attach user and tenant to request for use in controllers
      request.recapUser = validation.user;
      request.recapTenant = validation.tenant;

      return true;
    } catch (error) {
      this.logger.error(`Token validation failed: ${error.message}`);
      throw new UnauthorizedException('Token validation failed');
    }
  }

  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return null;
    }

    // Support both "Bearer token" and just "token"
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
    
    return authHeader;
  }
}
