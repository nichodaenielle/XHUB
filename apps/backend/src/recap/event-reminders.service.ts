import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBroadcastService } from '../websocket/realtime-broadcast.service';
import {
  EVENT_REMINDERS_CHANNEL,
  RECAP_SYSTEM_USER_EXTERNAL_ID,
} from './recap-channel.constants';

export interface PostEventReminderDto {
  tenant_id: string;
  event_id: string | number;
  event_name: string;
  start_at: string;
  end_at?: string | null;
  location?: string | null;
  window?: string;
  recap_event_url?: string;
}

@Injectable()
export class EventRemindersService {
  private readonly logger = new Logger(EventRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcast: RealtimeBroadcastService,
  ) {}

  async ensureSystemUser() {
    const existing = await this.prisma.user.findUnique({
      where: { externalId: RECAP_SYSTEM_USER_EXTERNAL_ID },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.user.create({
      data: {
        email: 'system@recap.local',
        username: 'recap_system',
        password: '',
        displayName: 'RECAP',
        externalId: RECAP_SYSTEM_USER_EXTERNAL_ID,
        status: 'OFFLINE',
      },
    });
  }

  async ensureEventRemindersChannel(workspaceId: string) {
    const existing = await this.prisma.channel.findFirst({
      where: { workspaceId, name: EVENT_REMINDERS_CHANNEL },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.channel.create({
      data: {
        workspaceId,
        name: EVENT_REMINDERS_CHANNEL,
        type: 'PUBLIC',
        description: 'Upcoming event reminders — acknowledge each notice (no chat)',
      },
    });
  }

  async postReminder(dto: PostEventReminderDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { externalId: String(dto.tenant_id) },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace not found for tenant ${dto.tenant_id}`);
    }

    const channel = await this.ensureEventRemindersChannel(workspace.id);
    const systemUser = await this.ensureSystemUser();

    const startAt = new Date(dto.start_at);
    const metadata = {
      kind: 'event_reminder',
      eventId: String(dto.event_id),
      eventName: dto.event_name,
      startAt: startAt.toISOString(),
      endAt: dto.end_at ? new Date(dto.end_at).toISOString() : null,
      location: dto.location ?? null,
      window: dto.window ?? 'default',
      recapEventUrl: dto.recap_event_url ?? null,
    };

    const content = this.formatReminderContent(dto, startAt);

    const message = await this.prisma.message.create({
      data: {
        channelId: channel.id,
        userId: systemUser.id,
        content,
        metadata: metadata as Prisma.InputJsonValue,
      },
      include: this.messageInclude(),
    });

    this.broadcast.emitChannelMessage(channel.id, message);
    this.logger.log(
      `Posted event reminder for event ${dto.event_id} (tenant ${dto.tenant_id}, window ${metadata.window})`,
    );

    return { channelId: channel.id, message };
  }

  private formatReminderContent(dto: PostEventReminderDto, startAt: Date): string {
    const when = startAt.toLocaleString('en-PH', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    const lines = [
      `📅 Upcoming event: ${dto.event_name}`,
      `When: ${when}`,
    ];
    if (dto.location) {
      lines.push(`Where: ${dto.location}`);
    }
    if (dto.window) {
      lines.push(`Reminder: ${dto.window} before start`);
    }
    lines.push('Tap Acknowledge below to confirm you have seen this reminder.');
    return lines.join('\n');
  }

  messageInclude() {
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
}
