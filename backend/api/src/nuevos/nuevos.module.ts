import { Module } from '@nestjs/common';
import { NuevosController } from './nuevos.controller';
import { NuevosService } from './nuevos.service';

@Module({ controllers: [NuevosController], providers: [NuevosService] })
export class NuevosModule {}
