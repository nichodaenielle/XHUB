import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { ChannelsModule } from '../channels/channels.module';
import { RealtimeBroadcastModule } from '../websocket/realtime-broadcast.module';

@Module({
  imports: [ChannelsModule, RealtimeBroadcastModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
