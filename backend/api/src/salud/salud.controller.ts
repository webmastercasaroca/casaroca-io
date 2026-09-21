import { Controller, Get } from '@nestjs/common';
import { Pool } from 'pg';
import { estadoDelLimite } from '../comun/limite';
import { MAX_SALUD } from '../db/pozos';

/**
 * Salud del servicio.
 *
 * ⛔ Un endpoint que devuelve «ok» siempre no sirve para nada: el
 * balanceador lo ve verde mientras la base está caída. Este comprueba de
 * verdad la base, el mantenimiento de particiones y el control de fugas,
 * que son las tres cosas que se caen en silencio.
 */
@Controller()
export class SaludController {
  private readonly pool = new Pool({
    host: process.env.PGHOST ?? '/tmp',
    port: Number(process.env.PGPORT ?? 5433),
    database: process.env.PGDATABASE ?? 'casaroca_dev',
    user: process.env.PGUSER ?? 'casaroca_app',
    password: process.env.PGPASSWORD || undefined,
    max: MAX_SALUD,
  } as any);

  /** Para el balanceador: rápido y binario. */
  @Get('salud')
  async salud() {
    const t = Date.now();
    await this.pool.query('SELECT 1');
    return { estado: 'vivo', baseMs: Date.now() - t, version: process.env.APP_VERSION ?? 'dev' };
  }

  /** Para el tablero técnico y el runbook: el detalle. */
  @Get('salud/detalle')
  async detalle() {
    const salidas: Record<string, unknown> = {};
    const problemas: string[] = [];

    try {
      const t = Date.now();
      await this.pool.query('SELECT 1');
      salidas.base = { estado: 'ok', ms: Date.now() - t };
    } catch (e) {
      salidas.base = { estado: 'caida', detalle: String(e) };
      problemas.push('la base de datos no responde');
    }

    try {
      const { rows } = await this.pool.query(
        `SELECT tabla, estado, dias_de_colchon FROM plataforma.v_salud_particiones`);
      salidas.particiones = rows;
      for (const r of rows) {
        if (r.estado !== 'BIEN') problemas.push(`particiones de ${r.tabla}: ${r.estado}`);
      }
    } catch { problemas.push('no se pudo leer la salud de particiones'); }

    try {
      const { rows } = await this.pool.query(
        `SELECT count(*)::int AS fugas FROM plataforma.v_control_rls WHERE veredicto LIKE 'FUGA%'`);
      salidas.fugasDeLectura = rows[0]?.fugas ?? null;
      if ((rows[0]?.fugas ?? 0) > 0) problemas.push(`${rows[0].fugas} tabla(s) legibles sin política`);
    } catch { /* sin permiso para la vista: no es un problema de salud */ }

    try {
      const { rows } = await this.pool.query(
        `SELECT tarea, ultima_corrida, hace FROM plataforma.v_ultimo_mantenimiento`);
      salidas.mantenimiento = rows;
    } catch { /* cerrado a la aplicación en algunos entornos */ }

    salidas.limiteDePeticiones = estadoDelLimite();
    salidas.version = process.env.APP_VERSION ?? 'dev';
    salidas.entorno = process.env.NODE_ENV ?? 'development';

    return { estado: problemas.length ? 'con problemas' : 'sano', problemas, ...salidas };
  }
}
