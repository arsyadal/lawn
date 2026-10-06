import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuth, Roles } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { CreateTeamMemberDto, UpdateTeamMemberDto } from './team.dto';
import { TeamService } from './team.service';

@Roles(UserRole.OWNER)
@Controller('api/team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.team.list(auth.tenantId);
  }

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() input: CreateTeamMemberDto) {
    return this.team.create(auth.tenantId, input);
  }

  @Patch(':id')
  update(@CurrentAuth() auth: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateTeamMemberDto) {
    return this.team.update(auth, id, input);
  }
}
