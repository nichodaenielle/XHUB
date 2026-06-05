import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecapService } from './recap.service';

@Injectable()
export class RecapSyncService {
  private readonly logger = new Logger(RecapSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recapService: RecapService,
  ) {}

  /**
   * Sync a user from RECAP to XHUB
   * Creates or updates user in XHUB based on RECAP user data
   */
  /**
   * Ensure every RECAP tenant user exists in the matching XHUB workspace.
   */
  async syncTenantMembers(recapTenantId: string): Promise<number> {
    const recapUsers = await this.recapService.getTenantUsers(recapTenantId);
    let synced = 0;

    for (const recapUser of recapUsers) {
      if (recapUser.is_active === false) {
        continue;
      }

      await this.syncUser(String(recapUser.id));
      const recapRole = Array.isArray(recapUser.roles) ? recapUser.roles[0] : undefined;
      await this.addUserToWorkspace(
        String(recapUser.id),
        recapTenantId,
        this.mapRecapRoleToXHUBRole(recapRole),
      );
      synced += 1;
    }

    this.logger.log(`Synced ${synced} users into workspace for tenant ${recapTenantId}`);
    return synced;
  }

  /**
   * Create department-scoped channels (idempotent).
   */
  async provisionDepartmentChannels(workspaceId: string, recapTenantId: string): Promise<void> {
    const departments = await this.recapService.getTenantDepartments(recapTenantId);

    for (const dept of departments) {
      const slug = (dept.slug || dept.code || `dept-${dept.id}`)
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const channelName = `dept-${slug}`.slice(0, 48);

      const existing = await this.prisma.channel.findFirst({
        where: { workspaceId, name: channelName },
      });

      if (!existing) {
        await this.prisma.channel.create({
          data: {
            workspaceId,
            name: channelName,
            type: 'PUBLIC',
            description: `Department: ${dept.name}`,
          },
        });
      }
    }
  }

  /**
   * Create subject-group discussion channels (idempotent).
   * Channel slug: sg-{recapSubjectGroupId} (from RECAP SubjectGroupMessagingService).
   */
  async provisionSubjectGroupChannels(workspaceId: string, recapTenantId: string): Promise<void> {
    const groups = await this.recapService.getTenantSubjectGroups(recapTenantId);

    for (const group of groups) {
      await this.ensureSubjectGroupChannel(workspaceId, group);
    }
  }

  async ensureSubjectGroupChannel(
    workspaceId: string,
    group: {
      id: string;
      tenant_id?: string;
      channel_name?: string;
      channel_description?: string;
      name?: string;
      subject_name?: string;
      member_user_ids?: string[];
      instructor_ids?: string[];
    },
  ): Promise<void> {
    const channelName = (group.channel_name || `sg-${group.id}`).slice(0, 48);
    const description =
      group.channel_description ||
      [group.subject_name, group.name].filter(Boolean).join(' — ') ||
      'Class section';
    const recapGroupId = String(group.id);
    const memberIds =
      group.member_user_ids?.length
        ? group.member_user_ids
        : (group.instructor_ids ?? []);

    const existing = await this.prisma.channel.findFirst({
      where: { workspaceId, name: channelName },
    });

    let channel = existing;

    if (!channel) {
      channel = await this.prisma.channel.create({
        data: {
          workspaceId,
          name: channelName,
          type: 'PRIVATE',
          description,
          externalId: recapGroupId,
        },
      });
    } else {
      channel = await this.prisma.channel.update({
        where: { id: channel.id },
        data: {
          type: 'PRIVATE',
          description,
          externalId: recapGroupId,
        },
      });
    }

    if (group.tenant_id && memberIds.length > 0) {
      await this.syncSubjectGroupChannelMembers(
        channel.id,
        String(group.tenant_id),
        memberIds.map(String),
      );
    }
  }

  /**
   * Sync RECAP user ids into a subject-group channel (instructors, enrolled students, admins).
   */
  async syncSubjectGroupChannelMembers(
    channelId: string,
    recapTenantId: string,
    recapUserIds: string[],
  ): Promise<number> {
    const xhubUserIds: string[] = [];
    const externalByXhubId = new Map<string, string>();

    for (const recapUserId of recapUserIds) {
      try {
        const recapUser = await this.recapService.getUser(recapUserId);
        if (recapUser.is_active === false) {
          continue;
        }
        const xhubUser = await this.syncUser(recapUserId);
        const recapRole = Array.isArray(recapUser.roles) ? recapUser.roles[0] : undefined;
        await this.addUserToWorkspace(
          recapUserId,
          recapTenantId,
          this.mapRecapRoleToXHUBRole(recapRole),
        );
        xhubUserIds.push(xhubUser.id);
        externalByXhubId.set(xhubUser.id, recapUserId);
      } catch (error: any) {
        this.logger.warn(
          `Skipped channel member sync for RECAP user ${recapUserId}: ${error.message}`,
        );
      }
    }

    const uniqueXhubIds = [...new Set(xhubUserIds)];

    if (uniqueXhubIds.length === 0) {
      await this.prisma.channelMember.deleteMany({ where: { channelId } });
      return 0;
    }

    await this.prisma.channelMember.deleteMany({
      where: {
        channelId,
        userId: { notIn: uniqueXhubIds },
      },
    });

    for (const userId of uniqueXhubIds) {
      await this.prisma.channelMember.upsert({
        where: {
          channelId_userId: { channelId, userId },
        },
        create: {
          channelId,
          userId,
          externalUserId: externalByXhubId.get(userId),
        },
        update: {
          externalUserId: externalByXhubId.get(userId),
        },
      });
    }

    return uniqueXhubIds.length;
  }

  async archiveSubjectGroupChannel(workspaceId: string, recapGroupId: string): Promise<void> {
    const channelName = `sg-${recapGroupId}`.slice(0, 48);
    const channel = await this.prisma.channel.findFirst({
      where: { workspaceId, name: channelName },
    });

    if (!channel) {
      return;
    }

    await this.prisma.channelMember.deleteMany({ where: { channelId: channel.id } });

    const archivedDescription = `[ARCHIVED] ${channel.description || ''}`.slice(0, 500);
    if (channel.description !== archivedDescription) {
      await this.prisma.channel.update({
        where: { id: channel.id },
        data: { description: archivedDescription },
      });
    }
  }

  private async workspaceForRecapTenant(recapTenantId: string) {
    return this.prisma.workspace.findUnique({
      where: { externalId: recapTenantId },
    });
  }

  async getWorkspaceByRecapTenantId(recapTenantId: string) {
    return this.workspaceForRecapTenant(recapTenantId);
  }

  /**
   * Create default public channels for a workspace (idempotent).
   */
  async ensureDefaultChannels(workspaceId: string): Promise<void> {
    const defaults = [
      { name: 'general', description: 'All members' },
      { name: 'announcements', description: 'Official notices' },
      {
        name: 'event-reminders',
        description: 'Upcoming event reminders — acknowledge each notice (no chat)',
      },
    ];

    for (const channel of defaults) {
      const existing = await this.prisma.channel.findFirst({
        where: { workspaceId, name: channel.name },
      });

      if (!existing) {
        await this.prisma.channel.create({
          data: {
            workspaceId,
            name: channel.name,
            type: 'PUBLIC',
            description: channel.description,
          },
        });
      }
    }
  }

  /**
   * Upsert a user directly from body data — no back-call to RECAP.
   */
  async upsertUserFromBody(userData: {
    id: string | number;
    email: string;
    name: string;
    roles?: string[];
    avatar_url?: string | null;
  }): Promise<any> {
    const recapUserId = String(userData.id);
    const existing = await this.prisma.user.findUnique({ where: { externalId: recapUserId } });

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { email: userData.email, displayName: userData.name, avatarUrl: userData.avatar_url ?? existing.avatarUrl },
      });
    }

    const username = userData.email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 8);
    return this.prisma.user.create({
      data: {
        email: userData.email,
        username,
        password: '',
        displayName: userData.name,
        avatarUrl: userData.avatar_url ?? null,
        externalId: recapUserId,
        status: 'OFFLINE',
      },
    });
  }

  /**
   * Upsert a workspace from body data — no back-call to RECAP, no channel provisioning.
   * Channel provisioning happens via POST /messaging/sync (admin-triggered).
   */
  async upsertWorkspaceFromBody(
    recapTenantId: string,
    tenantData: { name?: string; slug?: string } | null | undefined,
    ownerId: string,
  ): Promise<any> {
    const existing = await this.prisma.workspace.findUnique({ where: { externalId: recapTenantId } });

    if (existing) {
      if (tenantData?.name && existing.name !== tenantData.name) {
        return this.prisma.workspace.update({
          where: { id: existing.id },
          data: { name: tenantData.name, slug: tenantData.slug ?? existing.slug },
        });
      }
      return existing;
    }

    const workspace = await this.prisma.workspace.create({
      data: {
        name: tenantData?.name ?? `Tenant ${recapTenantId}`,
        slug: tenantData?.slug ?? recapTenantId,
        ownerId,
        externalId: recapTenantId,
      },
    });

    await this.ensureDefaultChannels(workspace.id);
    return workspace;
  }

  async syncUser(recapUserId: string): Promise<any> {
    try {
      const recapUser = await this.recapService.getUser(recapUserId);

      if (recapUser.is_active === false) {
        throw new Error(`RECAP user ${recapUserId} is inactive`);
      }
      
      // Check if user already exists in XHUB by externalId
      const existingUser = await this.prisma.user.findUnique({
        where: { externalId: recapUserId },
      });

      if (existingUser) {
        // Update existing user
        const updatedUser = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            email: recapUser.email,
            displayName: recapUser.name,
            avatarUrl: recapUser.avatar_url,
          },
        });

        this.logger.log(`Updated user: ${recapUserId}`);
        return updatedUser;
      }

      // Create new user
      // Generate a username from email
      const username = recapUser.email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 8);
      
      const newUser = await this.prisma.user.create({
        data: {
          email: recapUser.email,
          username: username,
          password: '', // No password needed for RECAP users
          displayName: recapUser.name,
          avatarUrl: recapUser.avatar_url,
          externalId: recapUserId,
          status: 'OFFLINE',
        },
      });

      this.logger.log(`Created new user: ${recapUserId}`);
      return newUser;
    } catch (error: any) {
      this.logger.error(`Failed to sync user ${recapUserId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync a tenant from RECAP to XHUB as a workspace
   */
  async syncTenant(recapTenantId: string, ownerId?: string): Promise<any> {
    try {
      // Fetch tenant from RECAP
      const recapTenant = await this.recapService.getTenant(recapTenantId);
      
      // Check if workspace already exists by externalId
      const existingWorkspace = await this.prisma.workspace.findUnique({
        where: { externalId: recapTenantId },
      });

      if (existingWorkspace) {
        const updatedWorkspace = await this.prisma.workspace.update({
          where: { id: existingWorkspace.id },
          data: {
            name: recapTenant.name,
            slug: recapTenant.slug,
          },
        });

        await this.ensureDefaultChannels(updatedWorkspace.id);
        await this.provisionDepartmentChannels(updatedWorkspace.id, recapTenantId);
        await this.provisionSubjectGroupChannels(updatedWorkspace.id, recapTenantId);
        this.logger.log(`Updated workspace: ${recapTenantId}`);
        return updatedWorkspace;
      }

      // Create new workspace
      // Need an owner - use the first synced user or create a system user
      const workspaceOwnerId = ownerId || await this.getOrCreateSystemUser();

      const newWorkspace = await this.prisma.workspace.create({
        data: {
          name: recapTenant.name,
          slug: recapTenant.slug,
          ownerId: workspaceOwnerId,
          externalId: recapTenantId,
        },
      });

      await this.ensureDefaultChannels(newWorkspace.id);
      await this.provisionDepartmentChannels(newWorkspace.id, recapTenantId);
      await this.provisionSubjectGroupChannels(newWorkspace.id, recapTenantId);
      this.logger.log(`Created new workspace: ${recapTenantId}`);
      return newWorkspace;
    } catch (error: any) {
      this.logger.error(`Failed to sync tenant ${recapTenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a user to a workspace (tenant)
   */
  async addUserToWorkspace(recapUserId: string, recapTenantId: string, role: string = 'MEMBER'): Promise<any> {
    try {
      // Get XHUB user and workspace
      const user = await this.prisma.user.findUnique({
        where: { externalId: recapUserId },
      });

      const workspace = await this.prisma.workspace.findUnique({
        where: { externalId: recapTenantId },
      });

      if (!user || !workspace) {
        throw new Error('User or workspace not found');
      }

      // Check if already a member
      const existingMember = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: user.id,
          },
        },
      });

      if (existingMember) {
        // Update role if needed
        if (existingMember.role !== role) {
          const updated = await this.prisma.workspaceMember.update({
            where: { id: existingMember.id },
            data: { role: role as any },
          });
          this.logger.log(`Updated user role in workspace: ${recapUserId} -> ${recapTenantId}`);
          return updated;
        }
        return existingMember;
      }

      // Add as member
      const newMember = await this.prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: role as any,
          externalUserId: recapUserId,
        },
      });

      this.logger.log(`Added user to workspace: ${recapUserId} -> ${recapTenantId}`);
      return newMember;
    } catch (error: any) {
      this.logger.error(`Failed to add user to workspace: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deactivate a user in XHUB (soft delete)
   */
  async deactivateUser(recapUserId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { externalId: recapUserId },
      });

      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            status: 'OFFLINE',
            // Optionally, you could add an isActive field
          },
        });

        this.logger.log(`Deactivated user: ${recapUserId}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to deactivate user ${recapUserId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Archive a workspace (tenant) in XHUB
   */
  async archiveWorkspace(recapTenantId: string): Promise<void> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { externalId: recapTenantId },
      });

      if (workspace) {
        // For now, we'll just mark it with a prefix
        // In production, you might want an archivedAt field
        await this.prisma.workspace.update({
          where: { id: workspace.id },
          data: {
            name: `[ARCHIVED] ${workspace.name}`,
          },
        });

        this.logger.log(`Archived workspace: ${recapTenantId}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to archive workspace ${recapTenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get or create a system user for workspace ownership
   */
  private async getOrCreateSystemUser(): Promise<string> {
    const systemUser = await this.prisma.user.findFirst({
      where: { email: 'system@xhub.local' },
    });

    if (systemUser) {
      return systemUser.id;
    }

    const newSystemUser = await this.prisma.user.create({
      data: {
        email: 'system@xhub.local',
        username: 'system',
        password: 'system',
        displayName: 'System User',
        status: 'OFFLINE',
      },
    });

    return newSystemUser.id;
  }

  /**
   * Map RECAP roles to XHUB workspace roles
   */
  mapRecapRoleToXHUBRole(recapRole: string | undefined | null): string {
    if (!recapRole) return 'MEMBER';
    const roleMap: Record<string, string> = {
      'admin': 'ADMIN',
      'staff': 'MODERATOR',
      'instructor': 'MODERATOR',
      'student': 'MEMBER',
    };

    return roleMap[recapRole] || 'MEMBER';
  }
}
