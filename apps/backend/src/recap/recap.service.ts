import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

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

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = process.env.RECAP_WEBHOOK_SECRET || '';
    // Simple HMAC verification (implement proper crypto in production)
    const expectedSignature = this.generateSignature(payload, webhookSecret);
    return signature === expectedSignature;
  }

  private generateSignature(payload: string, secret: string): string {
    // In production, use crypto.createHmac('sha256', secret).update(payload).digest('hex')
    // For now, return a simple hash
    return Buffer.from(payload + secret).toString('base64');
  }
}
