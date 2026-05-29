import { Controller, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getCurrentUser(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get('username/:username')
  @ApiOperation({ summary: 'Get user by username' })
  async getUserByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateCurrentUser(@Request() req, @Body() data: any) {
    return this.usersService.update(req.user.userId, data);
  }

  @Get('search/:query')
  @ApiOperation({ summary: 'Search users' })
  async searchUsers(@Param('query') query: string) {
    return this.usersService.search(query);
  }
}
