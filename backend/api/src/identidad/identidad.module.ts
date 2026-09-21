import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { IdentidadController } from './identidad.controller';
import { IdentidadService } from './identidad.service';

@Module({ imports: [DbModule], controllers: [IdentidadController], providers: [IdentidadService] })
export class IdentidadModule {}
