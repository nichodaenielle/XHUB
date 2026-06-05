import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RecapStrategy } from './strategies/recap.strategy';
import { UsersModule } from '../users/users.module';
import { RecapModule } from '../recap/recap.module';

@Module({
  imports: [
    UsersModule,
    forwardRef(() => RecapModule),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          // Keep auth resilient if env key is missing/empty in service context.
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '15m',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy, RecapStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
