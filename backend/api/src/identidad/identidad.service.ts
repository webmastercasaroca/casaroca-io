import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { contextoActual } from '../contexto/contexto';

/**
 * Identidad y accesos: lo que gobierna el Control Tower.
 *
 * ⛔ El permiso es de CUATRO dimensiones y las cuatro viajan juntas:
 * rol × alcance × techo × vigencia. Otorgar un rol sin decir hasta dónde
 * alcanza y hasta cuándo dura no es otorgar un permiso, es abrir una
 * puerta sin marco.
 */
@Injectable()
export class IdentidadService {
  async roles(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT codigo, nombre, alcance_maximo, nivel_maximo, descripcion
         FROM identidad.roles ORDER BY nivel_maximo DESC, nombre`);
    return rows;
  }

  async modulos(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT codigo, nombre, esquema, nivel_dato, es_nucleo, exige_compuerta_legal
         FROM sistema.modulos ORDER BY orden, nombre`);
    return rows;
  }

  /** La matriz: qué puede hacer cada rol en cada módulo. */
  async matriz(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT rol, modulo, accion, nivel_max FROM sistema.matriz_permisos
        ORDER BY rol, modulo, accion`);
    return rows;
  }

  async asignacionesDe(c: PoolClient, personaId: string) {
    const { rows } = await c.query(
      `SELECT a.id, a.rol, r.nombre AS rol_nombre, a.alcance_tipo, a.alcance_id,
              s.nombre AS sede_nombre, a.nivel_max, a.vigente_desde, a.vigente_hasta,
              a.acta_referencia,
              (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE) AS vigente
         FROM identidad.asignaciones a
         LEFT JOIN identidad.roles r ON r.codigo = a.rol
         LEFT JOIN org.sedes s ON s.id = a.alcance_id
        WHERE a.persona_id = $1
        ORDER BY vigente DESC, a.vigente_desde DESC`, [personaId]);
    return rows;
  }

  /** ⭐ Qué módulos alcanza REALMENTE una persona hoy. */
  async efectivo(c: PoolClient, personaId: string) {
    const { rows } = await c.query(
      `SELECT DISTINCT m.codigo, m.nombre, m.nivel_dato,
              min(a.nivel_max) OVER (PARTITION BY m.codigo) AS por_debajo_de
         FROM identidad.asignaciones a
         JOIN sistema.matriz_permisos p ON p.rol = a.rol
         JOIN sistema.modulos m ON m.codigo = p.modulo
        WHERE a.persona_id = $1
          AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
          AND m.nivel_dato <= a.nivel_max
        ORDER BY m.codigo`, [personaId]);
    return rows;
  }

  /**
   * Otorgar uno o varios roles EN UN SOLO ACTO.
   * ⛔ Es todo o nada. Media asignación es peor que ninguna: deja a
   * alguien con un rol y sin el otro, y nadie sabe si fue a propósito.
   * La transacción de la petición ya lo garantiza: si una falla, revierte.
   */
  /**
   * Otorgar uno o varios roles a una persona.
   *
   * ⛔ 20 de septiembre de 2026. Esto hacía un INSERT directo y solo
   * comprobaba el techo de nivel. NO llamaba a `exigir_admin_de`, que sí
   * llama la revocación: se podía DAR lo que no se podía QUITAR. Un
   * auditor lo probó con una cuenta de CONTABILIDAD, que no administra
   * identidad, otorgando AUDITOR/N3/organización a otra persona.
   *
   * Y el único freno que quedaba era la política de escritura, que solo
   * mira si quien llama es global: por eso un administrador de UNA sede
   * recibía 403 al otorgar dentro de su propia sede, mientras revocar sí
   * le funcionaba.
   *
   * Ahora va por `identidad.otorgar_asignacion` (migración 0066), que
   * lleva el guardia dentro, respeta el techo de quien llama y no deja
   * otorgar un alcance más ancho que el máximo del rol.
   */
  async otorgar(c: PoolClient, personaId: string, lista: any[]) {
    if (!Array.isArray(lista) || !lista.length) {
      throw new BadRequestException('No se indicó ningún rol que otorgar.');
    }
    const salida = [];
    for (const a of lista) {
      if (!a?.rol) throw new BadRequestException('Falta el código del rol.');
      const { rows: [r] } = await c.query(
        `SELECT identidad.otorgar_asignacion($1,$2,$3,$4,$5::smallint,$6,$7::date,$8::date) AS hecho`,
        [personaId, a.rol, a.alcanceTipo ?? null, a.alcanceId || null,
         a.nivelMax ?? null, a.acta ?? a.actaReferencia ?? null,
         a.desde ?? null, a.hasta ?? null]);
      salida.push(r.hecho);
    }
    return { ok: true, otorgados: salida };
  }


  /** Cerrar un acceso. ⛔ No se borra: se le pone fecha de fin. */
  /**
   * Quitarle un rol a alguien.
   *
   * ⛔ 20 de septiembre de 2026. Esto NO FUNCIONABA. Hacía un UPDATE
   * directo sobre `identidad.asignaciones`, que tiene RLS encendido y
   * solo políticas de SELECT e INSERT: sin política de UPDATE, Postgres
   * no toca ninguna fila y no se queja. La ruta veía cero filas y
   * respondía «No existe esa asignación, o no está a su alcance»
   * mientras la asignación existía y el rol seguía puesto.
   *
   * En una plataforma de accesos, no poder QUITAR un acceso es lo más
   * grave que puede fallar. Ahora va por `identidad.revocar_asignacion`
   * (migración 0063), que comprueba por dentro quién llama, exige el
   * motivo por escrito, deja el rastro de quién revocó y qué, y no deja
   * que se revoque el último rol capaz de administrar la red.
   */
  async cerrar(c: PoolClient, asignacionId: string, motivo?: string) {
    const { rows } = await c.query(
      `SELECT identidad.revocar_asignacion($1, $2) AS revocada`, [asignacionId, motivo ?? null]);
    return { ...rows[0].revocada, mensaje: 'Rol revocado. Queda en la ficha de la persona y en la auditoría.' };
  }

  /* ---------- casillas (migración 0037) ---------- */
  async atributos(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT id, codigo, etiqueta, ayuda, modulo, tipo_dato, nivel_dato, opciones, vigente
         FROM sistema.atributos ORDER BY modulo, orden, codigo`);
    return rows;
  }

  async crearAtributo(c: PoolClient, d: any) {
    if (!d?.codigo || !d?.etiqueta) throw new BadRequestException('Falta el código o la etiqueta.');
    if (d.nivel === undefined || d.nivel === null) {
      throw new BadRequestException(
        'Falta el nivel del dato. No tiene valor por defecto a propósito: quien crea la ' +
        'casilla tiene que decidir qué tan sensible es lo que va a guardar.');
    }
    const { rows } = await c.query(
      `SELECT sistema.crear_atributo($1,$2,$3,$4::sistema.tipo_dato_atributo,$5::smallint,$6::jsonb,$7) AS id`,
      [d.codigo, d.etiqueta, d.modulo ?? 'personas', d.tipo ?? 'texto',
       d.nivel, d.opciones ? JSON.stringify(d.opciones) : null, d.ayuda ?? null]);
    return { id: rows[0].id, codigo: d.codigo };
  }

  /* ── Catálogos editables (migración 0046) ─────────────────────────
     Es la respuesta a «si mañana necesito un culto de jóvenes, debe ser
     fácil»: agregar un valor es una llamada, no un despliegue. Y las
     máquinas de estado salen marcadas como cerradas, con su motivo. */

  async catalogos(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT codigo, nombre, descripcion, editable_por_sede, cerrado, motivo_cerrado,
              valores_vigentes, valores_retirados
         FROM sistema.v_catalogos ORDER BY cerrado, codigo`);
    return rows;
  }

  async valoresDeCatalogo(c: PoolClient, catalogo: string) {
    const { rows } = await c.query(
      `SELECT codigo, etiqueta, descripcion, orden, vigente, sede_id
         FROM sistema.catalogo_valores
        WHERE catalogo = $1 ORDER BY vigente DESC, orden, etiqueta`, [catalogo]);
    return rows;
  }

  async agregarValor(c: PoolClient, catalogo: string, v: {
    codigo: string; etiqueta: string; descripcion?: string | null; sedeId?: string | null; quien: string;
  }) {
    await c.query(`SELECT sistema.agregar_valor($1,$2,$3,$4,$5,$6,$7)`,
      [catalogo, v.codigo, v.etiqueta, v.descripcion ?? null, 100, v.sedeId ?? null, v.quien]);
    return { agregado: true, aviso: 'Disponible de inmediato. No hubo que desplegar nada.' };
  }

  async retirarValor(c: PoolClient, catalogo: string, codigo: string, motivo: string) {
    await c.query(`SELECT sistema.retirar_valor($1,$2,$3)`, [catalogo, codigo, motivo]);
    return { retirado: true,
             aviso: 'Las filas que ya lo usaban siguen legibles; lo que se impide es usarlo en filas nuevas.' };
  }
}
