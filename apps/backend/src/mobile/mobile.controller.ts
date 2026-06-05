import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('mobile')
@Controller('mobile')
export class MobileController {
  @Post('register-device')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register mobile device for push notifications' })
  async registerDevice(
    @Request() req,
    @Body() body: { deviceId: string; platform: 'ios' | 'android'; pushToken: string },
  ) {
    // TODO: Store device info and push token for the user
    return { success: true };
  }

  @Get('offline-messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get messages received while offline' })
  async getOfflineMessages(@Request() req) {
    // TODO: Return messages that were sent while user was offline
    return { messages: [] };
  }

  @Post('offline-sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload messages created while offline' })
  async syncOfflineMessages(
    @Request() req,
    @Body() body: { messages: Array<{ channelId: string; content: string; timestamp: Date }> },
  ) {
    // TODO: Process and store offline messages
    return { success: true, synced: body.messages.length };
  }
}
