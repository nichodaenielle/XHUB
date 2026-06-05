import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController, AttachmentsController, PollsController } from './messages.controller';
import { ChannelsModule } from '../channels/channels.module';
import { RealtimeBroadcastModule } from '../websocket/realtime-broadcast.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ChannelsModule, RealtimeBroadcastModule, StorageModule],
  controllers: [MessagesController, AttachmentsController, PollsController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
