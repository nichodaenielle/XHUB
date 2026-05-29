import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RecapModule } from '../recap/recap.module';
import { GatewayModule } from './gateway.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PrismaModule,
    MessagesModule,
    UsersModule,
    RecapModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [GatewayModule],
})
export class WebSocketModule {}
