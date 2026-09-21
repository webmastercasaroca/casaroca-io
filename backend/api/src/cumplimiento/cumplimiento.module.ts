import { Module } from '@nestjs/common';
import { CumplimientoController } from './cumplimiento.controller';
import { CumplimientoService } from './cumplimiento.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [CumplimientoController],
  providers: [CumplimientoService],
})
export class CumplimientoModule {}
