import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RecapService } from './recap.service';
import { RecapController } from './recap.controller';
import { RecapAuthGuard } from './recap-auth.guard';
import { RecapSyncService } from './recap-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [HttpModule, PrismaModule, AuthModule],
  controllers: [RecapController],
  providers: [RecapService, RecapAuthGuard, RecapSyncService],
  exports: [RecapService, RecapAuthGuard, RecapSyncService],
})
export class RecapModule {}
