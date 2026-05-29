import { Controller, Post, Body, HttpException, HttpStatus, Logger, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RecapService } from './recap.service';
import { RecapSyncService } from './recap-sync.service';
import { AuthService } from '../auth/auth.service';

@Controller('recap')
export class RecapController {
  private readonly logger = new Logger(RecapController.name);

  constructor(
    private readonly recapService: RecapService,
    private readonly recapSyncService: RecapSyncService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Exchange a RECAP-issued token for an XHUB access/refresh token pair.
   *
   * This enables the RECAP frontend to call XHUB APIs (which are protected by JwtAuthGuard)
   * without implementing XHUB username/password login.
   */
  @Post('exchange-token')
  async exchangeToken(
    @Req() req: Request,
    @Body() body: { token?: string; syncMembers?: boolean },
  ) {
    const header = req.headers.authorization;
    const bearer =
      typeof header === 'string' && header.toLowerCase().startsWith('bearer ')
        ? header.slice('bearer '.length)
        : null;

    const token = bearer || body?.token;

    if (!token) {
      throw new HttpException('No token provided', HttpStatus.BAD_REQUEST);
    }

    const validation = await this.recapService.validateToken(token);

    if (!validation.valid || !validation.user) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    const recapUserId = String(validation.user.id);
    let recapTenantId = validation.tenant?.id ? String(validation.tenant.id) : null;

    if (!recapTenantId) {
      try {
        const recapUser = await this.recapService.getUser(recapUserId);
        if (recapUser.tenant_id) {
          recapTenantId = String(recapUser.tenant_id);
        }
      } catch {
        // ignore; user may have no tenant
      }
    }

    const user = await this.recapSyncService.syncUser(recapUserId);

    if (recapTenantId) {
      const workspace = await this.recapSyncService.syncTenant(recapTenantId, user.id);

      const recapRole = Array.isArray(validation.user.roles) ? validation.user.roles[0] : undefined;
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

    const tokens = await this.authService.issueTokensForUser(user.id);

    return {
      success: true,
      userId: user.id,
      ...tokens,
    };
  }

  /**
   * Webhook endpoint for RECAP events
   */
  @Post('webhook')
  async handleWebhook(
    @Body() body: { event: string; data: any; signature?: string },
  ) {
    try {
      // Verify webhook signature if provided
      if (body.signature) {
        const payload = JSON.stringify({ event: body.event, data: body.data });
        const isValid = this.recapService.verifyWebhookSignature(payload, body.signature);
        
        if (!isValid) {
          throw new HttpException('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
        }
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
        default:
          this.logger.warn(`Unknown webhook event: ${body.event}`);
      }

      return { success: true };
    } catch (error) {
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
    const workspace = await this.recapSyncService.syncTenant(data.id);
    await this.recapSyncService.ensureDefaultChannels(workspace.id);
  }

  private async handleTenantUpdated(data: any) {
    this.logger.log(`Handling tenant.updated: ${data.id}`);
    await this.recapSyncService.syncTenant(data.id);
  }

  private async handleTenantDeleted(data: any) {
    this.logger.log(`Handling tenant.deleted: ${data.id}`);
    await this.recapSyncService.archiveWorkspace(data.id);
  }
}
