import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeBroadcastService {
  private server: Server | null = null;

  registerServer(server: Server): void {
    this.server = server;
  }

  emitChannelMessage(channelId: string, message: unknown): void {
    this.server?.to(`channel:${channelId}`).emit('message', message);
  }

  emitMessageUpdated(channelId: string, message: unknown): void {
    this.server?.to(`channel:${channelId}`).emit('message_updated', message);
  }
}
