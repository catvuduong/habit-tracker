import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DbModule } from './db.module.js';
import { HabitsModule } from './habits/habits.module.js';

@Module({
  imports: [DbModule, HabitsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
