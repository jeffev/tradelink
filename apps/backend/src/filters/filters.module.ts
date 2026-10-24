import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Filter } from './filter.entity';
import { FilterResult } from './filter-result.entity';
import { FiltersService } from './filters.service';
import { FiltersController } from './filters.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Filter, FilterResult])],
  providers: [FiltersService],
  controllers: [FiltersController],
  exports: [FiltersService],
})
export class FiltersModule {}
