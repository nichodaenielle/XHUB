import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return channel;
  }

  async findByWorkspace(workspaceId: string) {
    return this.prisma.channel.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });
  }

  async create(workspaceId: string, data: any) {
    return this.prisma.channel.create({
      data: {
        ...data,
        workspaceId,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.channel.update({
      where: { id },
      data,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.channel.delete({
      where: { id },
    });
  }

  async findOrCreateDirectChannel(
    workspaceId: string,
    userId: string,
    participantUserId: string,
  ) {
    if (userId === participantUserId) {
      throw new ForbiddenException('Cannot create a direct message with yourself');
    }

    const [userA, userB] = [userId, participantUserId].sort();
    const channelName = `dm:${userA}:${userB}`;

    const existing = await this.prisma.channel.findFirst({
      where: { workspaceId, name: channelName, type: 'DIRECT' },
    });

    if (existing) {
      return existing;
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId: { in: [userId, participantUserId] } },
        },
      },
    });

    if (!workspace || workspace.members.length < 2) {
      throw new ForbiddenException('Both users must belong to this workspace');
    }

    return this.prisma.channel.create({
      data: {
        workspaceId,
        name: channelName,
        type: 'DIRECT',
        description: 'Direct message',
      },
    });
  }

  async searchWorkspaceMembers(workspaceId: string, query: string, limit = 20) {
    return this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        user: {
          OR: [
            { displayName: { contains: query, mode: 'insensitive' } },
            { username: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            externalId: true,
          },
        },
      },
    });
  }

  async checkMembership(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel.workspace.members.length === 0) {
      throw new ForbiddenException('User is not a member of this workspace');
    }

    return channel;
  }
}
