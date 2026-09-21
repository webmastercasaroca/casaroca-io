import { BadRequestException, Controller, ForbiddenException, Get, Module, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, sesionDe } from '../comun/identidad.helper';

/**
 * El modelo del Drive «Sistema 100p», por HTTP y con SUS nombres.
 *
 * Jhon construye el frontend contra sus documentos (Usuarios v1.2, Roles,
 * Nuevos, Donaciones). Esta ruta le entrega esas mismas tablas leyendo la
 * base real: `GET /api/v1/modelo100p/personas`, `/donaciones`, `/usuario_roles`…
 *
 * ⛔ Solo lectura, y solo las 15 tablas de la lista: el nombre nunca se
 *    interpola sin pasar por ella. La sede la pone la RLS, igual que en el
 *    resto de la API.
 *
 * ⛔⛔ 20 sep 2026 · Y EL NIVEL NO LO PONÍA NADIE. Esta ruta devuelve
 *    `SELECT *`: TODAS las columnas, incluidas las de salud, las de
 *    menores y las de consejería. La RLS acotaba la sede pero no la
 *    sensibilidad, así que una sesión N1 podía pedir `/modelo100p/menores`
 *    y llevarse el volcado entero de su sede. La protección por columna
 *    existe (`plataforma.clasificacion_columna`) y esta puerta se la
 *    saltaba por el lado: no pedía columnas, pedía la tabla.
 *
 *    Ahora cada tabla exige el nivel de su columna MÁS sensible, que es lo
 *    coherente cuando se entregan todas. Quien no lo alcance tiene las
 *    rutas curadas (`/api/v1/personas`), que devuelven lo que su nivel
 *    permite ver en vez de negarle todo.
 */
const TABLAS = new Set([
  'personas', 'vinculos_personas', 'auditoria_personas', 'menores', 'minores',
  'roles', 'usuario_roles', 'permisos_por_rol', 'auditoria_roles',
  'nuevos_registros', 'contactos_nuevos', 'seguimiento_nuevos', 'integracion_personas',
  'donaciones', 'certificados', 'auditoria_donaciones',
]);

@Controller('api/v1/modelo100p')
export class Modelo100pController {
  constructor(private readonly db: DbService) {}

  @Get()
  tablas() {
    return { tablas: [...TABLAS], origen: 'Drive «Sistema 100p Casa Roca Global»', solo_lectura: true };
  }

  @Get(':tabla')
  leer(@Req() req: Request, @Param('tabla') tabla: string,
       @Query('limite') limite?: string, @Query('desde') desde?: string) {
    if (!TABLAS.has(tabla)) throw new BadRequestException(`«${tabla}» no es una tabla del modelo 100p.`);
    const lim = Math.min(Number(limite) || 100, 1000);
    const off = Math.max(Number(desde) || 0, 0);
    const s = sesionDe(req);
    return conSesion(this.db, req, async (c) => {
      /* El nivel lo dice la BASE a partir de la clasificación de cada
         columna, no una lista escrita a mano aquí: una lista en el código
         se queda atrás la primera vez que alguien añade una columna. */
      const { rows: [n] } = await c.query(
        `SELECT plataforma.nivel_que_exige('modelo100p', $1) AS nivel`, [tabla]);
      const exige = Number(n?.nivel ?? 4);
      if (s.nivelMax < exige) {
        throw new ForbiddenException(
          `«${tabla}» del modelo 100p se entrega con TODAS sus columnas, y la más ` +
          `sensible es de nivel N${exige}; su acceso llega a N${s.nivelMax}. ` +
          `Use las rutas curadas (por ejemplo /api/v1/personas), que devuelven ` +
          `lo que su nivel permite ver.`);
      }
      const { rows } = await c.query(`SELECT * FROM modelo100p.${tabla} LIMIT $1 OFFSET $2`, [lim, off]);
      return { tabla, nivel_exigido: exige, desde: off, filas: rows.length, datos: rows };
    });
  }
}

@Module({ imports: [DbModule], controllers: [Modelo100pController] })
export class Modelo100pModule {}
