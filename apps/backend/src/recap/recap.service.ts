import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import * as crypto from 'crypto';

interface TokenValidationResponse {
  valid: boolean;
  user?: any;
  tenant?: any;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  roles: string[];
  tenant_id?: string | null;
  is_active?: boolean;
  avatar_url?: string | null;
  [key: string]: any;
}

interface TenantData {
  id: string;
  name: string;
  slug: string;
  [key: string]: any;
}

@Injectable()
export class RecapService {
  private readonly logger = new Logger(RecapService.name);
  private readonly recapApiUrl: string;
  private readonly recapApiSecret: string;

  private readonly recapApiHost: string | undefined;

  constructor(private readonly httpService: HttpService) {
    this.recapApiUrl = process.env.RECAP_API_URL || 'http://localhost:8000';
    this.recapApiSecret = process.env.RECAP_API_SECRET || '';
    this.recapApiHost = process.env.RECAP_API_HOST || undefined;
  }

  private recapHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.recapApiSecret) {
      headers['X-API-Secret'] = this.recapApiSecret;
    }
    if (this.recapApiHost) {
      headers.Host = this.recapApiHost;
    }
    return headers;
  }

  /**
   * Validate a RECAP JWT token and return user/tenant information
   */
  async validateToken(token: string): Promise<TokenValidationResponse> {
    try {
      const response: AxiosResponse<TokenValidationResponse> = await firstValueFrom(
        this.httpService.post(
          `${this.recapApiUrl}/api/messaging/validate-token`,
          { token },
          {
            headers: this.recapHeaders({ 'Content-Type': 'application/json' }),
          },
        ),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to validate token: ${error.message}`);
      return { valid: false };
    }
  }

  /**
   * Fetch user data from RECAP by ID
   */
  async getUser(userId: string): Promise<UserData> {
    try {
      const response: AxiosResponse<UserData> = await firstValueFrom(
        this.httpService.get(`${this.recapApiUrl}/api/messaging/users/${userId}`, {
          headers: this.recapHeaders(),
        }),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to fetch user ${userId}: ${error.message}`);
      throw new Error('Failed to fetch user from RECAP');
    }
  }

  /**
   * Fetch tenant data from RECAP by ID
   */
  /**
   * List active users for a RECAP tenant (for bulk workspace sync).
   */
  async notifyMessageRecipients(payload: {
    recipients: string[];
    title: string;
    body: string;
    channelId?: string;
    tenantId?: string;
  }): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.recapApiUrl}/api/messaging/notify`,
          {
            recipients: payload.recipients,
            title: payload.title,
            body: payload.body,
            channel_id: payload.channelId,
            tenant_id: payload.tenantId,
          },
          { headers: this.recapHeaders() },
        ),
      );
    } catch (error: any) {
      this.logger.warn(`Failed to notify RECAP users: ${error.message}`);
    }
  }

  async getTenantDepartments(tenantId: string): Promise<Array<{ id: number; name: string; code?: string; slug?: string }>> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.recapApiUrl}/api/messaging/tenants/${tenantId}/departments`, {
          headers: this.recapHeaders(),
        }),
      );
      return response.data.departments ?? [];
    } catch (error: any) {
      this.logger.warn(`Failed to fetch tenant departments: ${error.message}`);
      return [];
    }
  }

  async getSubjectGroupMembers(subjectGroupId: string): Promise<{
    member_user_ids: string[];
    tenant_id?: string;
    channel_name?: string;
  }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.recapApiUrl}/api/messaging/subject-groups/${subjectGroupId}/members`,
          { headers: this.recapHeaders() },
        ),
      );
      return response.data;
    } catch (error: any) {
      this.logger.warn(`Failed to fetch subject group members: ${error.message}`);
      return { member_user_ids: [] };
    }
  }

  async getTenantSubjectGroups(tenantId: string): Promise<Array<{
    id: string;
    tenant_id: string;
    subject_id: string;
    subject_name?: string;
    subject_code?: string;
    name: string;
    code?: string;
    description?: string;
    channel_name: string;
    channel_description: string;
    instructor_ids?: string[];
    member_user_ids?: string[];
  }>> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.recapApiUrl}/api/messaging/tenants/${tenantId}/subject-groups`, {
          headers: this.recapHeaders(),
        }),
      );
      return response.data.subject_groups ?? [];
    } catch (error: any) {
      this.logger.warn(`Failed to fetch tenant subject groups: ${error.message}`);
      return [];
    }
  }

  async getTenantUsers(tenantId: string): Promise<UserData[]> {
    try {
      const response: AxiosResponse<{ users: UserData[] }> = await firstValueFrom(
        this.httpService.get(`${this.recapApiUrl}/api/messaging/tenants/${tenantId}/users`, {
          headers: this.recapHeaders(),
        }),
      );

      return response.data.users ?? [];
    } catch (error: any) {
      this.logger.error(`Failed to fetch tenant users ${tenantId}: ${error.message}`);
      throw new Error('Failed to fetch tenant users from RECAP');
    }
  }

  async getTenant(tenantId: string): Promise<TenantData> {
    try {
      const response: AxiosResponse<TenantData> = await firstValueFrom(
        this.httpService.get(`${this.recapApiUrl}/api/messaging/tenants/${tenantId}`, {
          headers: this.recapHeaders(),
        }),
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to fetch tenant ${tenantId}: ${error.message}`);
      throw new Error('Failed to fetch tenant from RECAP');
    }
  }

  /** Max age (seconds) a signed webhook is accepted, to prevent replay. */
  private static readonly WEBHOOK_MAX_AGE_SECONDS = 300;

  /**
   * Verify an HMAC-SHA256 signed RECAP webhook.
   *
   * RECAP signs `${timestamp}.${JSON.stringify({ event, data })}` with the shared
   * webhook secret. We reconstruct the same signing string and compare in
   * constant time, rejecting stale timestamps to mitigate replay attacks.
   */
  verifyWebhook(event: string, data: any, timestamp: string | undefined, signature: string | undefined): boolean {
    const webhookSecret = process.env.RECAP_WEBHOOK_SECRET || '';

    if (!webhookSecret || !signature || !timestamp) {
      return false;
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      return false;
    }

    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - ts);
    if (ageSeconds > RecapService.WEBHOOK_MAX_AGE_SECONDS) {
      this.logger.warn(`Rejected webhook with stale timestamp (age ${ageSeconds}s)`);
      return false;
    }

    const payload = JSON.stringify({ event, data });
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    return this.timingSafeEqual(expected, signature);
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
