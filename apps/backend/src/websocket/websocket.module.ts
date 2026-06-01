import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RecapModule } from '../recap/recap.module';
import { GatewayModule } from './gateway.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { ChannelsModule } from '../channels/channels.module';
import { RealtimeBroadcastModule } from './realtime-broadcast.module';

@Module({
  imports: [
    PrismaModule,
    MessagesModule,
    UsersModule,
    ChannelsModule,
    RecapModule,
    RealtimeBroadcastModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [GatewayModule],
})
export class WebSocketModule {}
