import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import { RealtimeBroadcastService } from '../websocket/realtime-broadcast.service';
import {
  EVENT_REMINDER_ACK_EMOJI,
  isReadOnlyBroadcastChannel,
  RECAP_SYSTEM_USER_EXTERNAL_ID,
} from '../recap/recap-channel.constants';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private channelsService: ChannelsService,
    private broadcast: RealtimeBroadcastService,
  ) {}

  private messageInclude() {
    return {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          status: true,
        },
      },
      replyTo: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
      attachments: true,
    };
  }

  async findById(id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        attachments: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  async findByChannel(channelId: string, page = 1, limit = 50, userId?: string) {
    if (userId) {
      const allowed = await this.channelsService.canUserAccessChannel(channelId, userId);
      if (!allowed) {
        throw new ForbiddenException('Cannot read this channel');
      }
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { channelId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              status: true,
            },
          },
          replyTo: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          attachments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { channelId } }),
    ]);

    return {
      data: messages.reverse(),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(userId: string, data: any, broadcast = true) {
    const allowed = await this.channelsService.canUserAccessChannel(data.channelId, userId);
    if (!allowed) {
      throw new ForbiddenException('Cannot post to this channel');
    }

    const channel = await this.prisma.channel.findUnique({
      where: { id: data.channelId },
      select: { name: true, workspaceId: true },
    });

    if (channel && isReadOnlyBroadcastChannel(channel.name)) {
      const author = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { externalId: true },
      });
      if (author?.externalId !== RECAP_SYSTEM_USER_EXTERNAL_ID) {
        throw new ForbiddenException('This channel is read-only');
      }
    }

    const message = await this.prisma.message.create({
      data: {
        channelId: data.channelId,
        userId,
        content: data.content,
        replyToId: data.replyToId,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
        attachments: data.attachments
          ? {
              create: data.attachments,
            }
          : undefined,
      },
      include: this.messageInclude(),
    });

    // Update thread reply count if this is a reply
    if (data.replyToId) {
      await this.prisma.thread.upsert({
        where: { messageId: data.replyToId },
        create: {
          messageId: data.replyToId,
          channelId: data.channelId,
          replyCount: 1,
        },
        update: {
          replyCount: {
            increment: 1,
          },
        },
      });
    }

    // Broadcast to the channel so all connected users see the message in real-time.
    // This ensures REST API sends behave the same as Socket.IO sends.
    if (broadcast) {
      this.broadcast.emitChannelMessage(data.channelId, message);
    }

    return message;
  }

  async update(id: string, userId: string, data: any) {
    const message = await this.prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const editTimeLimit = 15 * 60 * 1000; // 15 minutes
    const timeSinceCreation = Date.now() - message.createdAt.getTime();

    if (timeSinceCreation > editTimeLimit) {
      throw new ForbiddenException('Message can only be edited within 15 minutes');
    }

    return this.prisma.message.update({
      where: { id },
      data: {
        ...data,
        editedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        attachments: true,
      },
    });
  }

  async delete(id: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    return this.prisma.message.delete({
      where: { id },
    });
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { channelId: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const allowed = await this.channelsService.canUserAccessChannel(message.channelId, userId);
    if (!allowed) {
      throw new ForbiddenException('Cannot react in this channel');
    }

    await this.prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
      create: {
        messageId,
        userId,
        emoji,
      },
      update: {},
    });

    const updated = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: this.messageInclude(),
    });

    if (updated) {
      this.broadcast.emitMessageUpdated(message.channelId, updated);
    }

    return updated;
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { channelId: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.prisma.messageReaction.delete({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    const updated = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: this.messageInclude(),
    });

    if (updated) {
      this.broadcast.emitMessageUpdated(message.channelId, updated);
    }

    return updated;
  }

  async toggleEventReminderAck(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { channel: { select: { name: true } } },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (!isReadOnlyBroadcastChannel(message.channel?.name)) {
      throw new ForbiddenException('Acknowledge is only for event reminders');
    }

    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji: EVENT_REMINDER_ACK_EMOJI,
        },
      },
    });

    if (existing) {
      return this.removeReaction(messageId, userId, EVENT_REMINDER_ACK_EMOJI);
    }

    return this.addReaction(messageId, userId, EVENT_REMINDER_ACK_EMOJI);
  }

  async pinMessage(id: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return this.prisma.message.update({
      where: { id },
      data: { pinned: true },
    });
  }

  async unpinMessage(id: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return this.prisma.message.update({
      where: { id },
      data: { pinned: false },
    });
  }
}
