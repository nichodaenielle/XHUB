import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get('channel/:channelId')
  @ApiOperation({ summary: 'Get messages by channel' })
  async getChannelMessages(
    @Param('channelId') channelId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.findByChannel(
      channelId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get message by ID' })
  async getMessage(@Param('id') id: string) {
    return this.messagesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new message' })
  async createMessage(@Request() req, @Body() data: any) {
    return this.messagesService.create(req.user.userId, data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update message' })
  async updateMessage(@Param('id') id: string, @Request() req, @Body() data: any) {
    return this.messagesService.update(id, req.user.userId, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete message' })
  async deleteMessage(@Param('id') id: string, @Request() req) {
    return this.messagesService.delete(id, req.user.userId);
  }

  @Post(':id/reactions')
  @ApiOperation({ summary: 'Add reaction to message' })
  async addReaction(@Param('id') id: string, @Request() req, @Body('emoji') emoji: string) {
    return this.messagesService.addReaction(id, req.user.userId, emoji);
  }

  @Delete(':id/reactions/:emoji')
  @ApiOperation({ summary: 'Remove reaction from message' })
  async removeReaction(@Param('id') id: string, @Param('emoji') emoji: string, @Request() req) {
    return this.messagesService.removeReaction(id, req.user.userId, emoji);
  }

  @Post(':id/pin')
  @ApiOperation({ summary: 'Pin message' })
  async pinMessage(@Param('id') id: string, @Request() req) {
    return this.messagesService.pinMessage(id, req.user.userId);
  }

  @Delete(':id/pin')
  @ApiOperation({ summary: 'Unpin message' })
  async unpinMessage(@Param('id') id: string, @Request() req) {
    return this.messagesService.unpinMessage(id, req.user.userId);
  }
}
