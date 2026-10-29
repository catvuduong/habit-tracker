import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service.js';

// Global so every feature module shares one connection pool.
@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
