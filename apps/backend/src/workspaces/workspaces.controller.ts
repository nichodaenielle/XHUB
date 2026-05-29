import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('workspaces')
@Controller('workspaces')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkspacesController {
  constructor(private workspacesService: WorkspacesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all user workspaces' })
  async getUserWorkspaces(@Request() req) {
    return this.workspacesService.getUserWorkspaces(req.user.userId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List workspace members' })
  async getWorkspaceMembers(@Param('id') id: string, @Request() req) {
    return this.workspacesService.getMembers(id, req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace by ID' })
  async getWorkspace(@Param('id') id: string) {
    return this.workspacesService.findById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get workspace by slug' })
  async getWorkspaceBySlug(@Param('slug') slug: string) {
    return this.workspacesService.findBySlug(slug);
  }

  @Post()
  @ApiOperation({ summary: 'Create new workspace' })
  async createWorkspace(@Request() req, @Body() data: any) {
    return this.workspacesService.create(req.user.userId, data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update workspace' })
  async updateWorkspace(@Param('id') id: string, @Request() req, @Body() data: any) {
    return this.workspacesService.update(id, req.user.userId, data);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add member to workspace' })
  async addMember(@Param('id') id: string, @Request() req, @Body() memberData: any) {
    return this.workspacesService.addMember(id, req.user.userId, memberData);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove member from workspace' })
  async removeMember(@Param('id') id: string, @Param('userId') userId: string, @Request() req) {
    return this.workspacesService.removeMember(id, req.user.userId, userId);
  }
}
