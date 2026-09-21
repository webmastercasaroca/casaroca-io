import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { NuevosModule } from './nuevos/nuevos.module';
import { SesionModule } from './sesion/sesion.module';
import { OrganizacionModule } from './organizacion/organizacion.module';
import { PersonasModule } from './personas/personas.module';
import { IdentidadModule } from './identidad/identidad.module';
import { AportesModule } from './aportes/aportes.module';
import { NotificacionesModule } from './notificaciones/notificaciones';
import { Modelo100pModule } from './modelo100p/modelo100p';
import { AuthModule } from './auth/auth.module';
import { AuthMiddleware } from './auth/auth.middleware';
import { SaludModule } from './salud/salud.module';
import { RocakidsModule } from './rocakids/rocakids.module';
import { CumplimientoModule } from './cumplimiento/cumplimiento.module';
import { AsistenciaModule } from './asistencia/asistencia';
import { GruposModule } from './grupos/grupos';
import { ConsejeriaModule } from './consejeria/consejeria';
import { FormacionModule } from './formacion/formacion';
import { TalentoModule } from './talento/talento';
import { AdministracionModule } from './administracion/administracion';
import { trazaYRegistro, cabecerasDeSeguridad } from './comun/peticion';

/**
 * ⭐ 19 sep 2026 · Entran AUTENTICACIÓN y SALUD, y toda petición pasa por
 * traza, cabeceras de seguridad y resolución de sesión. Hasta hoy la API
 * tenía nueve módulos de negocio y ninguna puerta.
 */
@Module({
  imports: [DbModule, AuthModule, SaludModule,
            SesionModule, OrganizacionModule, PersonasModule,
            IdentidadModule, AportesModule, NuevosModule,
            NotificacionesModule, Modelo100pModule,
            // 19 sep 2026 · el flujo del domingo, que no tenia API
            RocakidsModule,
            /* ⛔ 20 sep 2026 · Los derechos del titular (Ley 1581) estaban
               implementados en la base desde la migracion 0053 y NO TENIAN
               NI UNA RUTA: un derecho que solo puede ejercer quien sabe SQL
               no es un derecho, y ante la Superintendencia «esta en la base
               de datos» no es una respuesta. */
            CumplimientoModule,
            /* ⛔ 20 sep 2026 · Estos cinco tenian TABLAS y ninguna ruta: el
               modulo existia en `sistema.modulos`, la sede lo tenia
               encendido y no se podia usar desde ninguna parte. */
            AsistenciaModule, GruposModule, ConsejeriaModule,
            FormacionModule, TalentoModule,
            /* ⛔ 20 sep 2026 · No habia panel de administracion: el primer
               Pastor Director General se creaba con un comando en la
               terminal y los roles de las 36 sedes se otorgaban por SQL. */
            AdministracionModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cabecerasDeSeguridad, trazaYRegistro, AuthMiddleware).forRoutes('*');
  }
}
