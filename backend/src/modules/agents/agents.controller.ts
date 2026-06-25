import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ActivateAgentDto } from './dto/activate-agent.dto';
import { SyncPayloadDto } from './dto/sync-payload.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Public()
  @Post('agents/activate')
  activate(@Body() dto: ActivateAgentDto) {
    return this.agentsService.activate(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('agents/:id/heartbeat')
  heartbeat(@Param('id') id: string) {
    return this.agentsService.heartbeat(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('agents/:id/sync')
  sync(@Param('id') id: string, @Body() dto: SyncPayloadDto) {
    return this.agentsService.sync(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('agents')
  @Roles('super_admin', 'admin')
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
  ) {
    return this.agentsService.findAll({ page, limit, clientId, status });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('agents/:id')
  @Roles('super_admin', 'admin', 'client_manager')
  findOne(@Param('id') id: string) {
    return this.agentsService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('agents/:id')
  @Roles('super_admin', 'admin')
  remove(@Param('id') id: string) {
    return this.agentsService.remove(id);
  }
}
