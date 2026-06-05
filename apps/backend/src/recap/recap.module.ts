import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RecapService } from './recap.service';
import { RecapController } from './recap.controller';
import { RecapAuthGuard } from './recap-auth.guard';
import { RecapSyncService } from './recap-sync.service';
import { EventRemindersService } from './event-reminders.service';
import { RecapApiSecretGuard } from './recap-api-secret.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeBroadcastModule } from '../websocket/realtime-broadcast.module';

@Module({
  imports: [HttpModule, PrismaModule, forwardRef(() => AuthModule), RealtimeBroadcastModule],
  controllers: [RecapController],
  providers: [
    RecapService,
    RecapAuthGuard,
    RecapSyncService,
    EventRemindersService,
    RecapApiSecretGuard,
  ],
  exports: [RecapService, RecapAuthGuard, RecapSyncService, EventRemindersService],
})
export class RecapModule {}
