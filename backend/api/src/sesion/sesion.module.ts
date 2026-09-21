import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SesionController } from './sesion.controller';
import { SesionService } from './sesion.service';

@Module({ imports: [DbModule], controllers: [SesionController], providers: [SesionService] })
export class SesionModule {}
