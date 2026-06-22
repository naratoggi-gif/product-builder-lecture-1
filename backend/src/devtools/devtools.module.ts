import { Module } from '@nestjs/common';
import { DevtoolsController } from './devtools.controller';

@Module({
  controllers: [DevtoolsController],
})
export class DevtoolsModule {}
