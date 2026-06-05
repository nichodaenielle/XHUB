import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
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
    @Request() req,
    @Param('channelId') channelId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.findByChannel(
      channelId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      req.user.userId,
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

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Toggle acknowledge on an event reminder (no chat)' })
  async acknowledgeReminder(@Param('id') id: string, @Request() req) {
    return this.messagesService.toggleEventReminderAck(id, req.user.userId);
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

  @Post(':id/forward')
  @ApiOperation({ summary: 'Forward message to another channel' })
  async forwardMessage(@Param('id') id: string, @Request() req, @Body() data: any) {
    return this.messagesService.forwardMessage(id, req.user.userId, data);
  }
}

@ApiTags('attachments')
@Controller('attachments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AttachmentsController {
  constructor(private messagesService: MessagesService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload attachment' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(@Request() req, @UploadedFile() file: any, @Body() body: any) {
    return this.messagesService.uploadAttachment(req.user.userId, file, body.messageId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete attachment' })
  async deleteAttachment(@Param('id') id: string, @Request() req) {
    return this.messagesService.deleteAttachment(id, req.user.userId);
  }
}

@ApiTags('polls')
@Controller('polls')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PollsController {
  constructor(private messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Create poll' })
  async createPoll(@Request() req, @Body() data: any) {
    return this.messagesService.createPoll(req.user.userId, data);
  }

  @Post(':id/vote')
  @ApiOperation({ summary: 'Cast vote on poll' })
  async castVote(@Param('id') id: string, @Request() req, @Body() data: any) {
    return this.messagesService.castVote(id, req.user.userId, data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update poll (close poll)' })
  async updatePoll(@Param('id') id: string, @Request() req, @Body() data: any) {
    return this.messagesService.updatePoll(id, req.user.userId, data);
  }
}
