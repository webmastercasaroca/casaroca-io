import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { OrganizacionController } from './organizacion.controller';
import { OrganizacionService } from './organizacion.service';

@Module({ imports: [DbModule], controllers: [OrganizacionController], providers: [OrganizacionService] })
export class OrganizacionModule {}
