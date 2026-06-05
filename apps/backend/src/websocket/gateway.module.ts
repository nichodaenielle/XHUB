import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';
import { RecapService } from '../recap/recap.service';
import { ChannelsService } from '../channels/channels.service';
import { RealtimeBroadcastService } from './realtime-broadcast.service';
import { isReadOnlyBroadcastChannel } from '../recap/recap-channel.constants';
import Redis from 'ioredis';

const wsCorsOrigins = [
  process.env.FRONTEND_URL,
  process.env.RECAP_API_URL,
  process.env.XHUB_URL,
  'https://recap.cpu-crums.com',
  'https://xhub.cpu-crums.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://10.19.57.40:8000',
  'http://10.19.57.40:3001',
].filter((origin): origin is string => Boolean(origin));

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST'],
  },
})
export class GatewayModule implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private redisSubscriber: any;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private usersService: UsersService,
    private recapService: RecapService,
    private channelsService: ChannelsService,
    private broadcast: RealtimeBroadcastService,
  ) {}

  async afterInit() {
    this.broadcast.registerServer(this.server);
    
    // Initialize Redis subscriber for RECAP bridge events
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.redisSubscriber = new Redis(redisUrl);

    this.redisSubscriber.on('connect', () => {
      console.log('XHub: Connected to Redis for RECAP bridge');
      console.log(`XHub: Redis URL: ${redisUrl}`);
    });

    this.redisSubscriber.on('error', (err) => {
      console.error('XHub: Redis error:', err);
    });

    // Subscribe to RECAP bridge broadcasts
    const recapPrefix = process.env.RECAP_REDIS_PREFIX || 'xhub_broadcast_';
    try {
      await this.redisSubscriber.psubscribe(`${recapPrefix}*`);
      console.log(`XHub: Subscribed to RECAP bridge pattern: ${recapPrefix}*`);
    } catch (error) {
      console.error('XHub: Failed to subscribe to Redis pattern:', error);
    }

    this.redisSubscriber.on('pmessage', (pattern, channel, message) => {
      console.log(`\n[${new Date().toISOString()}] XHub: Received RECAP bridge event`);
      console.log(`Channel: ${channel}`);
      try {
        const event = JSON.parse(message);
        console.log(`Event: ${event.event}`);
        console.log(`Target: ${event.channel}`);
        this.handleRecapBridgeEvent(event);
      } catch (error) {
        console.error('XHub: Error parsing RECAP bridge event:', error);
      }
    });
  }

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

      // Join user-specific room using XHub user ID
      client.join(`user:${user.id}`);
      
      // Join user-specific room using RECAP external ID for bridge events
      if (user.externalId) {
        client.join(`user:${user.externalId}`);
        console.log(`User ${user.username} joined rooms: user:${user.id} and user:${user.externalId}`);
      } else {
        console.log(`User ${user.username} joined room: user:${user.id}`);
      }

      // Update user status to online
      await this.usersService.updateStatus(user.id, 'ONLINE');

      const workspaces = await this.prisma.workspace.findMany({
        where: {
          members: {
            some: { userId: user.id },
          },
        },
      });

      // Resolve each workspace's channels in parallel to reduce connect latency.
      await Promise.all(
        workspaces.map(async (workspace) => {
          client.join(`workspace:${workspace.id}`);
          
          // Join workspace room using RECAP external ID for bridge events
          if (workspace.externalId) {
            client.join(`tenant:${workspace.externalId}`);
          }
          
          const channels = await this.channelsService.findByWorkspace(workspace.id, user.id);
          channels.forEach((channel) => {
            client.join(`channel:${channel.id}`);
          });
        }),
      );

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
      const allowed = await this.channelsService.canUserAccessChannel(
        data.channelId,
        client.data.userId,
      );
      if (!allowed) {
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
    const channel = await this.prisma.channel.findUnique({
      where: { id: data.channelId },
      select: { name: true },
    });
    if (isReadOnlyBroadcastChannel(channel?.name)) {
      return;
    }
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
      const allowed = await this.channelsService.canUserAccessChannel(
        data.channelId,
        client.data.userId,
      );
      if (!allowed) {
        return { error: 'Not authorized' };
      }

      const channel = await this.prisma.channel.findUnique({
        where: { id: data.channelId },
        include: {
          workspace: {
            select: {
              id: true,
              externalId: true,
            },
          },
        },
      });

      if (!channel) {
        return { error: 'Channel not found' };
      }

      if (isReadOnlyBroadcastChannel(channel.name)) {
        return { error: 'This channel is read-only' };
      }

      const message = await this.messagesService.create(client.data.userId, {
        channelId: data.channelId,
        content: data.content.trim(),
        replyToId: data.replyToId,
      }, false); // Skip broadcast in service since gateway broadcasts below

      this.server.to(`channel:${data.channelId}`).emit('message', message);

      void this.notifyRecapRecipients(channel, message, client.data.userId);

      return { success: true, message };
    } catch (error: any) {
      console.error('Message send error:', error);
      return { error: error?.message || 'Failed to send message' };
    }
  }

  private async notifyRecapRecipients(channel: any, message: any, senderUserId: string) {
    if (!channel.workspace?.externalId) {
      return;
    }

    const isSection = channel.name?.startsWith('sg-');
    let recipients: string[] = [];

    if (isSection) {
      const channelMembers = await this.prisma.channelMember.findMany({
        where: { channelId: channel.id },
        include: { user: { select: { id: true, externalId: true } } },
      });
      recipients = channelMembers
        .filter((m) => m.userId !== senderUserId && m.user.externalId)
        .map((m) => String(m.user.externalId));
    } else {
      const members = await this.prisma.workspaceMember.findMany({
        where: { workspaceId: channel.workspaceId },
        include: { user: { select: { id: true, externalId: true, displayName: true } } },
      });
      recipients = members
        .filter((m) => m.userId !== senderUserId && m.user.externalId)
        .map((m) => String(m.user.externalId));
    }

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
      'event-reminders': 'Event reminders',
    };
    if (displayNames[channel.name]) {
      return displayNames[channel.name];
    }
    if (channel.name.startsWith('dept-')) {
      const dept = channel.name.slice(5).replace(/-/g, ' ');
      return dept.charAt(0).toUpperCase() + dept.slice(1);
    }
    if (channel.name.startsWith('sg-')) {
      return 'Class section';
    }
    return channel.name;
  }

  /** Handle RECAP bridge events from Redis */
  private handleRecapBridgeEvent(event: any) {
    console.log('XHub: Processing RECAP bridge event:', {
      event: event.event,
      channel: event.channel,
      source: event.source,
    });
    
    // The event format from bridge:
    // {
    //   event: "message.received",
    //   data: { ... },
    //   channel: "user.2" or "tenant.123",
    //   timestamp: ISO string,
    //   source: "recap"
    // }
    
    // Parse channel format: "user.123" or "tenant.456"
    const channelParts = event.channel.split('.');
    
    if (channelParts.length < 2) {
      console.warn(`XHub: Invalid channel format: ${event.channel}`);
      // Fallback: broadcast to all
      this.server.emit(event.event, {
        ...event.data,
        channel: event.channel,
        source: event.source,
        timestamp: event.timestamp,
      });
      return;
    }
    
    const [channelType, channelId] = channelParts;
    
    if (channelType === 'user') {
      // Emit to specific user room (RECAP user ID)
      const room = `user:${channelId}`;
      console.log(`XHub: Emitting ${event.event} to room ${room}`);
      this.server.to(room).emit(event.event, {
        ...event.data,
        source: event.source,
        timestamp: event.timestamp,
      });
    } else if (channelType === 'tenant') {
      // Emit to workspace/tenant room
      const room = `tenant:${channelId}`;
      console.log(`XHub: Emitting ${event.event} to room ${room}`);
      this.server.to(room).emit(event.event, {
        ...event.data,
        source: event.source,
        timestamp: event.timestamp,
      });
    } else {
      // Unknown channel type - broadcast to all as fallback
      console.warn(`XHub: Unknown channel type: ${channelType}`);
      this.server.emit(event.event, {
        ...event.data,
        channel: event.channel,
        source: event.source,
        timestamp: event.timestamp,
      });
    }
  }
}
