import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * Personas y su ficha 360.
 *
 * ⭐ La ficha NO consulta once esquemas. Lee `crm.linea_tiempo`, donde
 * cada módulo deja su hecho (migración 0036). Por eso un módulo nuevo
 * aparece aquí solo, sin tocar este archivo: es toda la razón de que la
 * línea de tiempo exista.
 *
 * ⛔ Y no se filtra por nivel a mano: la RLS de la línea compara el nivel
 * DEL HECHO con el techo del lector. Un aporte (N3) no le llega a un
 * líder (N2) aunque pida la ficha completa.
 */
@Injectable()
export class PersonasService {
  /**
   * Buscar personas.
   *
   * ⛔ 19 sep 2026 · Esto era un `ILIKE '%texto%'`. Con eso, quien buscaba
   * «Jon Chavez» no encontraba a «Jhon Chávez» y creaba el duplicado; y con
   * 25.000 personas llegando de 36 fuentes, los duplicados no son un riesgo,
   * son una certeza. Ahora llama a `nucleo.buscar_personas`, que tolera
   * erratas y tildes (trigramas) y además busca por documento, teléfono y
   * correo en el mismo cuadro.
   *
   * La función es STABLE y NO es SECURITY DEFINER a propósito: corre como el
   * invocador, así que la seguridad por fila se aplica igual. Una búsqueda
   * que se salta el aislamiento es la forma más cómoda de leer otra sede.
   */
  async buscar(c: PoolClient, q: string | undefined, limite: number) {
    if (!q || q.trim().length < 2) {
      const { rows } = await c.query(
        `SELECT p.id,
                trim(concat_ws(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido)) AS nombre,
                nullif(concat_ws(' ', p.tipo_documento, p.numero_documento), ' ') AS documento,
                s.codigo AS sede_codigo, p.estado::text AS estado, NULL::real AS parecido,
                'listado'::text AS por_que
           FROM nucleo.personas p
           LEFT JOIN org.sedes s ON s.id = p.sede_id
          WHERE p.eliminado_en IS NULL
          ORDER BY p.primer_apellido, p.primer_nombre
          LIMIT $1`, [limite]);
      return rows;
    }
    const { rows } = await c.query(
      `SELECT * FROM nucleo.buscar_personas($1, $2)`, [q.trim(), limite]);
    return rows;
  }

  /** Candidatos a ser la misma persona registrada dos veces. */
  async duplicados(c: PoolClient, personaId: string) {
    const { rows } = await c.query(
      `SELECT * FROM nucleo.candidatos_duplicado($1)`, [personaId]);
    return rows;
  }

  async ficha(c: PoolClient, id: string) {
    const { rows } = await c.query(
      `SELECT id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
              tipo_documento, numero_documento, fecha_nacimiento, email_principal,
              telefono_movil, direccion, estado, genero, estado_civil,
              nivel_compromiso, ha_sido_bautizado, fecha_bautismo, sede_id, creado_en,
              telefono_fijo, fecha_conversion, foto_url,
              nombre_corto, nacionalidad, pais_residencia, ciudad_residencia, zona,
              email_secundario, telefono_emergencia, es_cristiano, iglesia_anterior,
              es_ministro, en_directorio_publico
         FROM nucleo.personas WHERE id = $1 AND eliminado_en IS NULL`, [id]);
    if (!rows.length) throw new NotFoundException('No existe esa persona, o no está a su alcance.');
    return rows[0];
  }

  /**
   * «Módulo de PERSONAS: mantiene datos actualizados» (documento de
   * Usuarios v1.2). Solo los campos de la lista: el cliente nunca elige
   * columnas, y la sede, el estado y el linaje no se tocan desde aquí.
   * La auditoría la escribe la base: cada campo cambiado queda con su
   * valor anterior (ver `modelo100p.auditoria_personas`).
   */
  async actualizar(c: PoolClient, id: string, d: Record<string, any>) {
    const EDITABLES = ['primer_nombre','segundo_nombre','primer_apellido','segundo_apellido',
      'tipo_documento','numero_documento','fecha_nacimiento','email_principal','telefono_movil',
      'telefono_fijo','direccion','genero','estado_civil','nivel_compromiso','fecha_conversion',
      'ha_sido_bautizado','fecha_bautismo','foto_url','nombre_corto','nacionalidad',
      'pais_residencia','ciudad_residencia','zona','email_secundario','telefono_emergencia',
      'es_cristiano','iglesia_anterior','es_ministro','en_directorio_publico'];
    const campos = Object.keys(d ?? {}).filter(k => EDITABLES.includes(k));
    if (!campos.length) {
      throw new BadRequestException(`Nada que actualizar. Campos permitidos: ${EDITABLES.join(', ')}.`);
    }
    const sets = campos.map((k, i) => `${k} = $${i + 2}`).join(', ');
    try {
      const { rowCount } = await c.query(
        `UPDATE nucleo.personas SET ${sets}, actualizado_en = now()
          WHERE id = $1 AND eliminado_en IS NULL`,
        [id, ...campos.map(k => d[k] === '' ? null : d[k])]);
      if (!rowCount) throw new NotFoundException('No existe esa persona, o no está a su alcance.');
    } catch (e: any) {
      if (e.code === '22P02' || e.code === '23514' || e.code === '22007' || e.code === '23503') {
        throw new BadRequestException('Algún valor no es válido: ' + e.message);
      }
      if (e.code === '23505') throw new BadRequestException('Ese correo o documento ya pertenece a otra persona.');
      throw e;
    }
    return this.ficha(c, id);
  }

  /** ⭐ La línea de tiempo: todo lo que le ha pasado, venga del módulo que venga. */
  async lineaTiempo(c: PoolClient, id: string, limite: number) {
    const { rows } = await c.query(
      `SELECT l.ocurrido_en, l.tipo, t.nombre AS tipo_nombre, t.nivel,
              l.entidad_modulo, l.entidad_tipo, l.entidad_id, l.resumen, l.detalle
         FROM crm.linea_tiempo l
         LEFT JOIN crm.tipos_hecho t ON t.codigo = l.tipo
        WHERE l.persona_id = $1
        ORDER BY l.ocurrido_en DESC
        LIMIT $2`, [id, limite]);
    return rows;
  }

  /** Las casillas que la iglesia añadió sin migración (0037). */
  async atributos(c: PoolClient, id: string) {
    const { rows } = await c.query(
      `SELECT codigo, etiqueta, modulo, tipo_dato, nivel_dato, valor, actualizado_en
         FROM nucleo.v_persona_atributos WHERE persona_id = $1
        ORDER BY modulo, codigo`, [id]);
    return rows;
  }

  async fijarAtributo(c: PoolClient, id: string, codigo: string, valor: any) {
    const { rows: [attr] } = await c.query(
      `SELECT id, tipo_dato, opciones FROM sistema.atributos WHERE codigo = $1 AND vigente`, [codigo]);
    if (!attr) throw new NotFoundException(`No existe la casilla «${codigo}».`);

    /* ⛔ Si la casilla es de opción cerrada, el valor tiene que estar en
       la lista. Un desplegable que acepta texto libre deja de ser un
       desplegable y nadie podrá agrupar por él después. */
    if (['opcion','multiopcion'].includes(attr.tipo_dato) && attr.opciones) {
      const permitidos: string[] = attr.opciones;
      const vs = Array.isArray(valor) ? valor : [valor];
      const malo = vs.find(v => !permitidos.includes(v));
      if (malo !== undefined) {
        throw new BadRequestException(
          `«${malo}» no es una opción de esta casilla. Las válidas son: ${permitidos.join(', ')}.`);
      }
    }
    const { rows } = await c.query(
      `INSERT INTO nucleo.persona_atributos (persona_id, atributo_id, valor, actualizado_en)
       VALUES ($1,$2,$3::jsonb, now())
       ON CONFLICT (persona_id, atributo_id)
       DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now()
       RETURNING valor, actualizado_en`,
      [id, attr.id, JSON.stringify(valor)]);
    if (!rows.length) {
      throw new BadRequestException('Esa casilla está por encima de su nivel de acceso.');
    }
    return rows[0];
  }

  /** «Tráeme todos los que…»: el arrastre que pidió Daniel. */
  async porAtributo(c: PoolClient, codigo: string, valor: any) {
    const { rows } = await c.query(
      `SELECT pa.persona_id, p.primer_nombre, p.primer_apellido, p.sede_id, pa.valor
         FROM sistema.personas_con_atributo($1, $2::jsonb) pa
         JOIN nucleo.personas p ON p.id = pa.persona_id
        WHERE p.eliminado_en IS NULL
        ORDER BY p.primer_apellido`,
      [codigo, valor === undefined ? null : JSON.stringify(valor)]);
    return rows;
  }
}
