import { Module } from '@nestjs/common';
import { ConsistencyController } from './consistency.controller';
import { ConsistencyService } from './consistency.service';

@Module({
  controllers: [ConsistencyController],
  providers: [ConsistencyService],
})
export class ConsistencyModule {}
