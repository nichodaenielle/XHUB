import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search across all content' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'workspaceId', required: false })
  async searchAll(@Query('q') query: string, @Query('workspaceId') workspaceId?: string) {
    return this.searchService.searchAll(query, workspaceId);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Search messages' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'channelId', required: false })
  @ApiQuery({ name: 'workspaceId', required: false })
  async searchMessages(
    @Query('q') query: string,
    @Query('channelId') channelId?: string,
    @Query('workspaceId') workspaceId?: string,
  ) {
    const filters: any = {};
    if (channelId) filters.channelId = channelId;
    if (workspaceId) filters.workspaceId = workspaceId;

    return this.searchService.searchMessages(query, Object.keys(filters).length > 0 ? filters : undefined);
  }

  @Get('users')
  @ApiOperation({ summary: 'Search users' })
  @ApiQuery({ name: 'q', required: true })
  async searchUsers(@Query('q') query: string) {
    return this.searchService.searchUsers(query);
  }

  @Get('channels')
  @ApiOperation({ summary: 'Search channels' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'workspaceId', required: false })
  async searchChannels(@Query('q') query: string, @Query('workspaceId') workspaceId?: string) {
    return this.searchService.searchChannels(query, workspaceId ? { workspaceId } : undefined);
  }
}
