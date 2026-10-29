import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { HabitInput, OverviewQuery } from './habit-input.js';
import { parseDay, parseHabitInput } from './habit-input.js';
import { HabitsService } from './habits.service.js';

@Controller('habits')
export class HabitsController {
  constructor(private readonly habits: HabitsService) {}

  @Get()
  list(@Query('includeArchived') includeArchived?: string) {
    return this.habits.list(includeArchived === 'true');
  }

  // Declared before any `:id` route so `overview` is never read as an id.
  @Get('overview')
  overview(@Query() query: OverviewQuery) {
    return this.habits.overview(query);
  }

  @Post()
  create(@Body() body: HabitInput) {
    return this.habits.create(parseHabitInput(body, false) as { name: string; emoji: string; color: string });
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: HabitInput) {
    return this.habits.update(id, parseHabitInput(body, true));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.habits.archive(id);
  }

  @Put(':id/checkins/:day')
  checkIn(@Param('id', ParseIntPipe) id: number, @Param('day') day: string) {
    return this.habits.setCheckin(id, parseDay(day), true);
  }

  @Delete(':id/checkins/:day')
  @HttpCode(HttpStatus.NO_CONTENT)
  uncheck(@Param('id', ParseIntPipe) id: number, @Param('day') day: string) {
    return this.habits.setCheckin(id, parseDay(day), false);
  }
}
