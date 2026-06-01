import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('channels')
@Controller('channels')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Get('workspace/:workspaceId/members/search')
  @ApiOperation({ summary: 'Search workspace members' })
  async searchMembers(
    @Param('workspaceId') workspaceId: string,
    @Query('q') query: string,
  ) {
    if (!query?.trim()) {
      return [];
    }
    const members = await this.channelsService.searchWorkspaceMembers(
      workspaceId,
      query.trim(),
    );
    return members.map((m) => m.user);
  }

  @Get('workspace/:workspaceId')
  @ApiOperation({ summary: 'Get channels by workspace' })
  async getWorkspaceChannels(@Param('workspaceId') workspaceId: string, @Request() req) {
    return this.channelsService.findByWorkspace(workspaceId, req.user.userId);
  }

  @Post('direct')
  @ApiOperation({ summary: 'Find or create a direct message channel' })
  async createDirectChannel(
    @Request() req,
    @Body() body: { workspaceId: string; participantUserId: string },
  ) {
    return this.channelsService.findOrCreateDirectChannel(
      body.workspaceId,
      req.user.userId,
      body.participantUserId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get channel by ID' })
  async getChannel(@Param('id') id: string) {
    return this.channelsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new channel' })
  async createChannel(@Body() data: any) {
    return this.channelsService.create(data.workspaceId, data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update channel' })
  async updateChannel(@Param('id') id: string, @Body() data: any) {
    return this.channelsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete channel' })
  async deleteChannel(@Param('id') id: string) {
    return this.channelsService.delete(id);
  }
}
