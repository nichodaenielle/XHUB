import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class RecapStrategy extends PassportStrategy(Strategy, 'recap') {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.loginWithRecapCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid RECAP credentials');
    }
    return user;
  }
}
