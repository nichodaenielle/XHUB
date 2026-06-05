import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
// import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ChannelsModule } from './channels/channels.module';
import { MessagesModule } from './messages/messages.module';
import { WebSocketModule } from './websocket/websocket.module';
import { NotificationsModule } from './notifications/notifications.module';
// import { SearchModule } from './search/search.module';
// import { StorageModule } from './storage/storage.module';
// import { QueueModule } from './queue/queue.module';
import { RecapModule } from './recap/recap.module';
import { HealthModule } from './health/health.module';
import { RealtimeBroadcastModule } from './websocket/realtime-broadcast.module';
import { MobileModule } from './mobile/mobile.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    // BullModule.forRoot({
    //   redis: {
    //     host: process.env.REDIS_HOST || 'localhost',
    //     port: parseInt(process.env.REDIS_PORT) || 6379,
    //     password: process.env.REDIS_PASSWORD,
    //   },
    // }),
    PrismaModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ChannelsModule,
    MessagesModule,
    WebSocketModule,
    NotificationsModule,
    // SearchModule,
    // StorageModule,
    // QueueModule,
    RecapModule,
    HealthModule,
    RealtimeBroadcastModule,
    MobileModule,
  ],
})
export class AppModule {}
