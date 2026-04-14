import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { DCAJob } from './dca-job.entity';
import { DCAService } from './dca.service';
import { DCAController } from './dca.controller';
import { DCAProcessor } from './processors/dca.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([DCAJob]),
    BullModule.registerQueue({ name: 'dca' }),
  ],
  controllers: [DCAController],
  providers: [DCAService, DCAProcessor],
})
export class DCAModule {}
