import { Controller, Post, Get, Body, HttpException, HttpStatus, Logger, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RecapService } from './recap.service';
import { RecapSyncService } from './recap-sync.service';
import { EventRemindersService, PostEventReminderDto } from './event-reminders.service';
import { RecapApiSecretGuard } from './recap-api-secret.guard';
import { AuthService } from '../auth/auth.service';

@Controller('recap')
export class RecapController {
  private readonly logger = new Logger(RecapController.name);

  constructor(
    private readonly recapService: RecapService,
    private readonly recapSyncService: RecapSyncService,
    private readonly eventRemindersService: EventRemindersService,
    private readonly authService: AuthService,
  ) {}

  /**
   * RECAP posts upcoming-event reminders into the event-reminders channel (service auth).
   */
  @Post('event-reminder')
  @UseGuards(RecapApiSecretGuard)
  async postEventReminder(@Body() body: PostEventReminderDto) {
    if (!body?.tenant_id || !body?.event_id || !body?.event_name || !body?.start_at) {
      throw new HttpException('Missing required fields', HttpStatus.BAD_REQUEST);
    }

    const result = await this.eventRemindersService.postReminder(body);
    return { success: true, ...result };
  }

  /**
   * Exchange a RECAP-issued token for an XHUB access/refresh token pair.
   *
   * This enables the RECAP frontend to call XHUB APIs (which are protected by JwtAuthGuard)
   * without implementing XHUB username/password login.
   */
  @Post('exchange-token')
  @UseGuards(RecapApiSecretGuard)
  async exchangeToken(
    @Req() req: Request,
    @Body() body: { token?: string; recapToken?: string; user?: any; tenant?: any; syncMembers?: boolean },
  ) {
    const userData = body.user;
    const tenantData = body.tenant;

    if (!userData || !userData.id) {
      throw new HttpException('User data required', HttpStatus.BAD_REQUEST);
    }

    const recapUserId = String(userData.id);
    let recapTenantId = tenantData?.id ? String(tenantData.id) : null;
    if (!recapTenantId && userData.tenant_id) {
      recapTenantId = String(userData.tenant_id);
    }

    // Upsert the user directly from the body — no back-call to RECAP needed.
    const user = await this.recapSyncService.upsertUserFromBody(userData);

    if (recapTenantId) {
      // Upsert workspace from body data, skipping expensive channel provisioning.
      const workspace = await this.recapSyncService.upsertWorkspaceFromBody(
        recapTenantId,
        tenantData,
        user.id,
      );

      const recapRole = Array.isArray(userData.roles) ? userData.roles[0] : undefined;
      const xhubRole = this.recapSyncService.mapRecapRoleToXHUBRole(recapRole);
      await this.recapSyncService.addUserToWorkspace(recapUserId, recapTenantId, xhubRole);

      if (body.syncMembers === true) {
        await this.recapSyncService.syncTenantMembers(recapTenantId);
      }

      return {
        success: true,
        userId: user.id,
        workspaceId: workspace.id,
        ...(await this.authService.issueTokensForUser(user.id)),
      };
    }

    return {
      success: true,
      userId: user.id,
      ...(await this.authService.issueTokensForUser(user.id)),
    };
  }

  /**
   * Messaging token endpoint for RECAP to get XHUB access token
   * This is called by RECAP's messaging feature to authenticate with XHUB
   */
  @Get('messaging/token')
  @UseGuards(RecapApiSecretGuard)
  async getMessagingToken(@Req() req: Request) {
    // Generate a service token for RECAP messaging integration
    // This token should have limited permissions for messaging operations
    const serviceUserId = 'recap-messaging-service';
    
    try {
      const user = await this.recapSyncService.syncUser(serviceUserId);
      const tokens = await this.authService.issueTokensForUser(user.id);
      
      return {
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      this.logger.error(`Failed to generate messaging token: ${error.message}`);
      throw new HttpException('Failed to generate messaging token', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Webhook endpoint for RECAP events
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: Request,
    @Body() body: { event: string; data: any; timestamp?: string; signature?: string },
  ) {
    try {
      // Signed webhooks are mandatory. Accept the signature/timestamp from headers
      // (preferred) or the body for backward compatibility.
      const headerSignature = req.headers['x-recap-signature'];
      const headerTimestamp = req.headers['x-recap-timestamp'];
      const signature =
        (typeof headerSignature === 'string' ? headerSignature : undefined) ?? body.signature;
      const timestamp =
        (typeof headerTimestamp === 'string' ? headerTimestamp : undefined) ?? body.timestamp;

      const isValid = this.recapService.verifyWebhook(body.event, body.data, timestamp, signature);
      if (!isValid) {
        throw new HttpException('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Received webhook event: ${body.event}`);

      // Handle different webhook events
      switch (body.event) {
        case 'user.created':
          await this.handleUserCreated(body.data);
          break;
        case 'user.updated':
          await this.handleUserUpdated(body.data);
          break;
        case 'user.deleted':
          await this.handleUserDeleted(body.data);
          break;
        case 'tenant.created':
          await this.handleTenantCreated(body.data);
          break;
        case 'tenant.updated':
          await this.handleTenantUpdated(body.data);
          break;
        case 'tenant.deleted':
          await this.handleTenantDeleted(body.data);
          break;
        case 'subject_group.created':
          await this.handleSubjectGroupCreated(body.data);
          break;
        case 'subject_group.updated':
          await this.handleSubjectGroupUpdated(body.data);
          break;
        case 'subject_group.deleted':
          await this.handleSubjectGroupDeleted(body.data);
          break;
        default:
          this.logger.warn(`Unknown webhook event: ${body.event}`);
      }

      return { success: true };
    } catch (error) {
      // Preserve auth/validation status codes (e.g. 401 invalid signature).
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Webhook processing failed: ${error.message}`);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async handleUserCreated(data: any) {
    this.logger.log(`Handling user.created: ${data.id}`);
    await this.recapSyncService.syncUser(data.id);
    if (data.tenant_id) {
      await this.recapSyncService.syncTenant(String(data.tenant_id));
      const recapRole = Array.isArray(data.roles) ? data.roles[0] : undefined;
      await this.recapSyncService.addUserToWorkspace(
        String(data.id),
        String(data.tenant_id),
        this.recapSyncService.mapRecapRoleToXHUBRole(recapRole),
      );
    }
  }

  private async handleUserUpdated(data: any) {
    this.logger.log(`Handling user.updated: ${data.id}`);
    await this.recapSyncService.syncUser(data.id);
    if (data.tenant_id) {
      const recapRole = Array.isArray(data.roles) ? data.roles[0] : undefined;
      await this.recapSyncService.addUserToWorkspace(
        String(data.id),
        String(data.tenant_id),
        this.recapSyncService.mapRecapRoleToXHUBRole(recapRole),
      );
    }
  }

  private async handleUserDeleted(data: any) {
    this.logger.log(`Handling user.deleted: ${data.id}`);
    await this.recapSyncService.deactivateUser(data.id);
  }

  private async handleTenantCreated(data: any) {
    this.logger.log(`Handling tenant.created: ${data.id}`);
    // syncTenant provisions general, dept-*, and sg-* channels
    await this.recapSyncService.syncTenant(data.id);
  }

  private async handleTenantUpdated(data: any) {
    this.logger.log(`Handling tenant.updated: ${data.id}`);
    await this.recapSyncService.syncTenant(data.id);
  }

  private async handleTenantDeleted(data: any) {
    this.logger.log(`Handling tenant.deleted: ${data.id}`);
    await this.recapSyncService.archiveWorkspace(data.id);
  }

  private async handleSubjectGroupCreated(data: any) {
    this.logger.log(`Handling subject_group.created: ${data.id}`);
    await this.handleSubjectGroupUpsert(data);
  }

  private async handleSubjectGroupUpdated(data: any) {
    this.logger.log(`Handling subject_group.updated: ${data.id}`);
    await this.handleSubjectGroupUpsert(data);
  }

  private async handleSubjectGroupDeleted(data: any) {
    this.logger.log(`Handling subject_group.deleted: ${data.id}`);
    if (!data?.tenant_id || !data?.id) {
      return;
    }
    const workspace = await this.recapSyncService.getWorkspaceByRecapTenantId(String(data.tenant_id));
    if (workspace) {
      await this.recapSyncService.archiveSubjectGroupChannel(workspace.id, String(data.id));
    }
  }

  private async handleSubjectGroupUpsert(data: any) {
    if (!data?.tenant_id) {
      return;
    }
    const workspace = await this.recapSyncService.syncTenant(String(data.tenant_id));
    await this.recapSyncService.ensureSubjectGroupChannel(workspace.id, data);
  }
}
