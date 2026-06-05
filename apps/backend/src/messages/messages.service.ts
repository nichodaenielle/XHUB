import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import { RealtimeBroadcastService } from '../websocket/realtime-broadcast.service';
import { StorageService } from '../storage/storage.service';
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
    private storage: StorageService,
  ) {}

  /**
   * Parse mentions from message content and return array of mentioned user display names
   */
  private parseMentions(content: string): string[] {
    if (!content) return [];
    const mentionRegex = /@([^\s]+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }

  /**
   * Find users by display names that match mentions
   */
  private async findUsersByDisplayNames(displayNames: string[], workspaceId: string) {
    if (displayNames.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: {
        displayName: {
          in: displayNames,
        },
        workspaceMemberships: {
          some: {
            workspaceId,
          },
        },
      },
      select: {
        id: true,
        displayName: true,
      },
    });
    return users;
  }

  /** Map DB row to API/socket shape (soft-deleted messages hide content). */
  private toClientMessage<T extends { deletedAt?: Date | null; content?: string; replyTo?: unknown }>(
    message: T,
  ): T & { deleted?: boolean; content: string | null } {
    if (!message) return message as T & { deleted?: boolean; content: string | null };
    let out: T & { deleted?: boolean; content: string | null } = {
      ...message,
      content: message.content ?? '',
    };
    if (message.replyTo) {
      out = {
        ...out,
        replyTo: this.toClientMessage(message.replyTo as { deletedAt?: Date | null; content?: string }),
      };
    }
    if (message.deletedAt) {
      out = { ...out, content: null, deleted: true };
    }
    return out;
  }

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
      poll: {
        include: {
          message: {
            select: {
              userId: true,
            },
          },
          options: {
            include: {
              votes: {
                include: {
                  user: {
                    select: {
                      id: true,
                      displayName: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  async findById(id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: this.messageInclude(),
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return this.toClientMessage(message);
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
        include: this.messageInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { channelId } }),
    ]);

    return {
      data: messages.reverse().map((m) => this.toClientMessage(m)),
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
        content: data.content || '',
        replyToId: data.replyToId,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
      include: this.messageInclude(),
    });

    // Create attachments separately if provided
    if (data.attachments && data.attachments.length > 0) {
      await this.prisma.messageAttachment.createMany({
        data: data.attachments.map((att: any) => ({
          messageId: message.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          url: att.url,
          thumbnailUrl: att.thumbnailUrl,
        })),
      });
      // Re-fetch message to include newly created attachments
      const messageWithAttachments = await this.prisma.message.findUnique({
        where: { id: message.id },
        include: this.messageInclude(),
      });
      if (messageWithAttachments) {
        Object.assign(message, messageWithAttachments);
      }
    }

    // Parse mentions and create mention records
    const mentionedDisplayNames = this.parseMentions(data.content);
    if (mentionedDisplayNames.length > 0 && channel?.workspaceId) {
      const mentionedUsers = await this.findUsersByDisplayNames(
        mentionedDisplayNames,
        channel.workspaceId,
      );
      
      // Create mention records for matched users (excluding the sender)
      const mentionsToCreate = mentionedUsers
        .filter((u) => u.id !== userId)
        .map((user) => ({
          messageId: message.id,
          mentionedUserId: user.id,
          channelId: data.channelId,
        }));

      if (mentionsToCreate.length > 0) {
        await this.prisma.mention.createMany({
          data: mentionsToCreate,
        });

        // Emit mention events to mentioned users
        for (const mention of mentionsToCreate) {
          this.broadcast.emitMentionReceived(mention.mentionedUserId, {
            messageId: message.id,
            channelId: data.channelId,
            mentionedBy: userId,
            content: data.content,
          });
        }
      }
    }

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
      this.broadcast.emitChannelMessage(data.channelId, this.toClientMessage(message));
    }

    return this.toClientMessage(message);
  }

  async update(id: string, userId: string, data: any) {
    const message = await this.prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.deletedAt) {
      throw new ForbiddenException('Cannot edit a deleted message');
    }

    console.log('[Message Update] userId comparison:', {
      messageUserId: message.userId,
      requestUserId: userId,
      match: message.userId === userId,
    });

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const editTimeLimit = 15 * 60 * 1000; // 15 minutes
    const timeSinceCreation = Date.now() - message.createdAt.getTime();

    if (timeSinceCreation > editTimeLimit) {
      throw new ForbiddenException('Message can only be edited within 15 minutes');
    }

    const updated = await this.prisma.message.update({
      where: { id },
      data: {
        ...data,
        editedAt: new Date(),
      },
      include: this.messageInclude(),
    });

    const client = this.toClientMessage(updated);
    this.broadcast.emitMessageUpdated(updated.channelId, client);
    return client;
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

    if (message.deletedAt) {
      return this.toClientMessage(
        await this.prisma.message.findUnique({
          where: { id },
          include: this.messageInclude(),
        }),
      );
    }

    const updated = await this.prisma.message.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        content: '',
      },
      include: this.messageInclude(),
    });

    const client = this.toClientMessage(updated);
    this.broadcast.emitMessageDeleted(updated.channelId, {
      messageId: id,
      channelId: updated.channelId,
    });
    return client;
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
      this.broadcast.emitMessageUpdated(message.channelId, this.toClientMessage(updated));
    }

    return updated ? this.toClientMessage(updated) : updated;
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
      this.broadcast.emitMessageUpdated(message.channelId, this.toClientMessage(updated));
    }

    return updated ? this.toClientMessage(updated) : updated;
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

  async uploadAttachment(userId: string, file: any, messageId?: string) {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new ForbiddenException('File type not allowed');
    }

    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      throw new ForbiddenException('File size exceeds 25MB limit');
    }

    const uploadResult = await this.storage.uploadAttachmentFile(file);

    if (messageId) {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      if (message.userId !== userId) {
        throw new ForbiddenException('You can only add attachments to your own messages');
      }
    }

    const attachment = await this.prisma.messageAttachment.create({
      data: {
        messageId: messageId || '',
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        url: uploadResult.url,
        thumbnailUrl: uploadResult.thumbnailUrl,
      },
    });

    return attachment;
  }

  async deleteAttachment(attachmentId: string, userId: string) {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      include: { message: true },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (attachment.message.userId !== userId) {
      throw new ForbiddenException('You can only delete your own attachments');
    }

    await this.storage.deleteFile(attachment.url);

    await this.prisma.messageAttachment.delete({
      where: { id: attachmentId },
    });

    return { success: true };
  }

  async forwardMessage(messageId: string, userId: string, data: any) {
    const originalMessage = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { attachments: true },
    });

    if (!originalMessage) {
      throw new NotFoundException('Message not found');
    }

    const allowed = await this.channelsService.canUserAccessChannel(data.targetChannelId, userId);
    if (!allowed) {
      throw new ForbiddenException('Cannot post to target channel');
    }

    const attachmentsToInclude = data.includeAttachments
      ? originalMessage.attachments.map(a => ({
          fileName: a.fileName,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
          url: a.url,
          thumbnailUrl: a.thumbnailUrl,
        }))
      : [];

    // Get source channel name if provided
    let sourceChannelName = null;
    if (data.sourceChannelId) {
      const sourceChannel = await this.prisma.channel.findUnique({
        where: { id: data.sourceChannelId },
        select: { name: true, type: true },
      });
      if (sourceChannel) {
        // For DM channels, look up the peer user's display name
        if (sourceChannel.type === 'DIRECT' && sourceChannel.name?.startsWith('dm:')) {
          const parts = sourceChannel.name.split(':');
          if (parts.length === 3) {
            const [_, userId1, userId2] = parts;
            const peerId = userId1 === originalMessage.userId ? userId2 : userId1;
            const peerUser = await this.prisma.user.findUnique({
              where: { id: peerId },
              select: { displayName: true },
            });
            if (peerUser) {
              sourceChannelName = peerUser.displayName;
            }
          }
        } else {
          sourceChannelName = sourceChannel.name;
        }
      }
    }

    const forwardedMessage = await this.create(userId, {
      channelId: data.targetChannelId,
      content: originalMessage.content,
      metadata: {
        kind: 'forward',
        forwardedFrom: {
          messageId: originalMessage.id,
          channelId: originalMessage.channelId,
          channelName: sourceChannelName,
          userId: originalMessage.userId,
        },
      },
      attachments: attachmentsToInclude,
    });

    return forwardedMessage;
  }

  async createPoll(userId: string, data: any) {
    const allowed = await this.channelsService.canUserAccessChannel(data.channelId, userId);
    if (!allowed) {
      throw new ForbiddenException('Cannot create poll in this channel');
    }

    const message = await this.create(userId, {
      channelId: data.channelId,
      content: data.question,
      metadata: {
        kind: 'poll',
      },
    });

    const poll = await this.prisma.poll.create({
      data: {
        messageId: message.id,
        question: data.question,
        allowMultiple: data.allowMultiple || false,
        allowRevote: data.allowRevote || false,
        anonymous: data.anonymous || false,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        options: {
          create: data.options.map((text: string, index: number) => ({
            text,
            order: index,
          })),
        },
      },
      include: {
        message: {
          select: {
            userId: true,
          },
        },
        options: true,
      },
    });

    // Get the full message for WebSocket broadcast
    const fullMessage = await this.findById(message.id);

    // Emit the message via WebSocket broadcast
    this.broadcast.emitChannelMessage(data.channelId, fullMessage);

    // Return just the poll object for the API response
    return poll;
  }

  async castVote(pollId: string, userId: string, data: any) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { message: true },
    });

    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    if (poll.closedAt) {
      throw new ForbiddenException('Poll is closed');
    }

    if (poll.expiresAt && new Date() > poll.expiresAt) {
      throw new ForbiddenException('Poll has expired');
    }

    const allowed = await this.channelsService.canUserAccessChannel(poll.message.channelId, userId);
    if (!allowed) {
      throw new ForbiddenException('Cannot vote in this channel');
    }

    if (!poll.allowRevote) {
      const existingVote = await this.prisma.pollVote.findFirst({
        where: {
          pollId,
          userId,
        },
      });

      if (existingVote) {
        throw new ForbiddenException('You have already voted in this poll');
      }
    }

    if (!poll.allowMultiple && data.optionIds.length > 1) {
      throw new ForbiddenException('This poll does not allow multiple selections');
    }

    // Delete existing votes if revoting
    if (poll.allowRevote) {
      await this.prisma.pollVote.deleteMany({
        where: {
          pollId,
          userId,
        },
      });
    }

    // Create new votes
    const votes = await this.prisma.pollVote.createMany({
      data: data.optionIds.map((optionId: string) => ({
        pollId,
        optionId,
        userId,
      })),
    });

    const updatedPoll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        message: {
          select: {
            userId: true,
          },
        },
        options: {
          include: {
            votes: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return updatedPoll;
  }

  async updatePoll(pollId: string, userId: string, data: any) {
    console.log('[MessagesService] updatePoll called:', { pollId, userId, data });

    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { 
        message: true,
        options: true,
      },
    });

    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    if (poll.message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own polls');
    }

    // Check if poll has votes - if so, restrict editing question/options
    const voteCount = await this.prisma.pollVote.count({
      where: { pollId },
    });

    // Only block if question or options are actually being changed (not just sent in request)
    const questionChanged = data.question !== undefined && data.question !== poll.question;
    const optionsChanged = data.options !== undefined && JSON.stringify(data.options) !== JSON.stringify(poll.options.map(o => o.text));

    if (voteCount > 0 && (questionChanged || optionsChanged)) {
      throw new ForbiddenException('Cannot edit question or options after votes have been cast');
    }

    // Build update data
    const updateData: any = {};

    if (data.question !== undefined) {
      updateData.question = data.question;
    }

    if (data.allowMultiple !== undefined) {
      updateData.allowMultiple = data.allowMultiple;
    }

    if (data.allowRevote !== undefined) {
      updateData.allowRevote = data.allowRevote;
    }

    if (data.anonymous !== undefined) {
      updateData.anonymous = data.anonymous;
    }

    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    }

    if (data.closed !== undefined) {
      updateData.closedAt = data.closed ? new Date() : null;
    }

    console.log('[MessagesService] updateData:', updateData);

    // Handle options update (only if no votes)
    if (data.options && voteCount === 0) {
      // Delete existing options
      await this.prisma.pollOption.deleteMany({
        where: { pollId },
      });

      // Create new options
      if (data.options.length >= 2) {
        await this.prisma.pollOption.createMany({
          data: data.options.map((text: string, index: number) => ({
            pollId,
            text,
            order: index,
          })),
        });
      }
    }

    // Update poll
    const updated = await this.prisma.poll.update({
      where: { id: pollId },
      data: updateData,
      include: {
        message: {
          select: {
            userId: true,
          },
        },
        options: {
          include: {
            votes: true,
          },
        },
      },
    });

    console.log('[MessagesService] Updated poll:', updated);

    return updated;
  }
}
