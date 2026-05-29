import { Module } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';
import { RecapService } from '../recap/recap.service';

const wsCorsOrigins = [
  process.env.FRONTEND_URL,
  process.env.RECAP_API_URL,
  process.env.XHUB_URL,
  'https://recap.cpu-crums.com',
  'https://xhub.cpu-crums.com',
  'http://localhost:3000',
  'http://localhost:5173',
].filter((origin): origin is string => Boolean(origin));

@WebSocketGateway({
  cors: {
    origin: wsCorsOrigins.length > 0 ? wsCorsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST'],
  },
})
export class GatewayModule implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private usersService: UsersService,
    private recapService: RecapService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        client.disconnect();
        return;
      }

      client.data.userId = user.id;
      client.data.username = user.username;

      // Update user status to online
      await this.usersService.updateStatus(user.id, 'ONLINE');

      // Join user's workspace channels
      const workspaces = await this.prisma.workspace.findMany({
        where: {
          members: {
            some: { userId: user.id },
          },
        },
        include: {
          channels: true,
        },
      });

      workspaces.forEach((workspace) => {
        workspace.channels.forEach((channel) => {
          client.join(`channel:${channel.id}`);
        });
        client.join(`workspace:${workspace.id}`);
      });

      // Notify others that user is online
      workspaces.forEach((workspace) => {
        this.server.to(`workspace:${workspace.id}`).emit('user_online', {
          userId: user.id,
          username: user.username,
          status: 'ONLINE',
        });
      });

      console.log(`User ${user.username} connected`);
    } catch (error) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      // Update user status to offline
      await this.usersService.updateStatus(userId, 'OFFLINE');

      // Notify others that user is offline
      const workspaces = await this.prisma.workspace.findMany({
        where: {
          members: {
            some: { userId },
          },
        },
      });

      workspaces.forEach((workspace) => {
        this.server.to(`workspace:${workspace.id}`).emit('user_offline', {
          userId,
          status: 'OFFLINE',
        });
      });

      console.log(`User ${client.data.username} disconnected`);
    }
  }

  @SubscribeMessage('join_channel')
  async handleJoinChannel(client: Socket, data: { channelId: string }) {
    try {
      const channel = await this.prisma.channel.findUnique({
        where: { id: data.channelId },
        include: {
          workspace: {
            include: {
              members: {
                where: { userId: client.data.userId },
              },
            },
          },
        },
      });

      if (!channel || channel.workspace.members.length === 0) {
        return { error: 'Not authorized to join this channel' };
      }

      client.join(`channel:${data.channelId}`);
      return { success: true };
    } catch (error) {
      return { error: 'Failed to join channel' };
    }
  }

  @SubscribeMessage('leave_channel')
  async handleLeaveChannel(client: Socket, data: { channelId: string }) {
    client.leave(`channel:${data.channelId}`);
    return { success: true };
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(client: Socket, data: { channelId: string }) {
    client.to(`channel:${data.channelId}`).emit('user_typing', {
      channelId: data.channelId,
      userId: client.data.userId,
      username: client.data.username,
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(client: Socket, data: { channelId: string }) {
    client.to(`channel:${data.channelId}`).emit('user_stopped_typing', {
      channelId: data.channelId,
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('message')
  async handleMessage(
    client: Socket,
    data: { channelId: string; content: string; replyToId?: string },
  ) {
    if (!client.data.userId || !data?.channelId || !data?.content?.trim()) {
      return { error: 'Invalid message' };
    }

    try {
      const channel = await this.prisma.channel.findUnique({
        where: { id: data.channelId },
        include: {
          workspace: {
            select: {
              id: true,
              externalId: true,
              members: {
                where: { userId: client.data.userId },
              },
            },
          },
        },
      });

      if (!channel || channel.workspace.members.length === 0) {
        return { error: 'Not authorized' };
      }

      const message = await this.messagesService.create(client.data.userId, {
        channelId: data.channelId,
        content: data.content.trim(),
        replyToId: data.replyToId,
      });

      this.server.to(`channel:${data.channelId}`).emit('message', message);

      void this.notifyRecapRecipients(channel, message, client.data.userId);

      return { success: true, message };
    } catch {
      return { error: 'Failed to send message' };
    }
  }

  private async notifyRecapRecipients(channel: any, message: any, senderUserId: string) {
    if (!channel.workspace?.externalId) {
      return;
    }

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: channel.workspaceId },
      include: { user: { select: { id: true, externalId: true, displayName: true } } },
    });

    const recipients = members
      .filter((m) => m.userId !== senderUserId && m.user.externalId)
      .map((m) => String(m.user.externalId));

    if (recipients.length === 0) {
      return;
    }

    const senderName = message.user?.displayName || 'Someone';
    const preview = String(message.content).slice(0, 120);
    const channelLabel = this.formatDiscussionLabel(channel);

    await this.recapService.notifyMessageRecipients({
      recipients,
      title: `${senderName} in ${channelLabel}`,
      body: preview,
      channelId: channel.id,
      tenantId: channel.workspace.externalId,
    });
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(client: Socket, data: { messageId: string }) {
    // Broadcast to channel that message was read
    const message = await this.prisma.message.findUnique({
      where: { id: data.messageId },
    });

    if (message) {
      this.server.to(`channel:${message.channelId}`).emit('message_read', {
        messageId: data.messageId,
        userId: client.data.userId,
      });
    }
  }

  /** User-facing discussion title (neutral labels; slugs unchanged in DB). */
  private formatDiscussionLabel(channel: { type: string; name: string }): string {
    if (channel.type === 'DIRECT') {
      return 'Private message';
    }
    const displayNames: Record<string, string> = {
      general: 'All members',
      announcements: 'Official notices',
    };
    if (displayNames[channel.name]) {
      return displayNames[channel.name];
    }
    if (channel.name.startsWith('dept-')) {
      const dept = channel.name.slice(5).replace(/-/g, ' ');
      return dept.charAt(0).toUpperCase() + dept.slice(1);
    }
    return channel.name;
  }
}
