import { Module } from '@nestjs/common';
import { RocakidsService } from './rocakids.service';
import { RocakidsController } from './rocakids.controller';
@Module({ providers: [RocakidsService], controllers: [RocakidsController] })
export class RocakidsModule {}
