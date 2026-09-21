import { Module } from '@nestjs/common';
import { SaludController } from './salud.controller';
@Module({ controllers: [SaludController] })
export class SaludModule {}
