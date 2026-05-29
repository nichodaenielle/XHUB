import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
    BullModule.registerQueue({
      name: 'emails',
    }),
    BullModule.registerQueue({
      name: 'media',
    }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
