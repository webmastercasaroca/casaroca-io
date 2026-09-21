import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { PersonasController } from './personas.controller';
import { PersonasService } from './personas.service';

@Module({ imports: [DbModule], controllers: [PersonasController], providers: [PersonasService] })
export class PersonasModule {}
