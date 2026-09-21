import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * RocaKids: la operación del domingo.
 *
 * ⛔ Lo difícil ya estaba en la base desde la migración 0014: acudiente
 * obligatorio, código cifrado, entrega verificada, intentos fallidos
 * registrados. Esta capa NO reimplementa nada de eso: llama a las
 * funciones y deja que la base rechace lo que tenga que rechazar. Cada vez
 * que una regla de seguridad se reimplementa en la aplicación, aparece una
 * segunda verdad que tarde o temprano se separa de la primera.
 */
@Injectable()
export class RocakidsService {
  /** Las salas de las sedes que la sesión alcanza, con su estado de ahora. */
  async salas(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT sa.id, sa.codigo, sa.nombre, sa.edad_min, sa.edad_max, sa.capacidad,
              sa.sede_id, s.codigo AS sede_codigo,
              v.ninos_dentro, v.adultos, v.regla_dos_adultos
         FROM rocakids.salas sa
         JOIN org.sedes s ON s.id = sa.sede_id
         LEFT JOIN rocakids.v_sala_ahora v ON v.sala_id = sa.id
        WHERE sa.activa
        ORDER BY s.codigo, sa.edad_min`);
    return rows;
  }

  /**
   * El censo de la sala: quién puede entrar hoy.
   *
   * ⛔ Devuelve nombre, edad y si ya está dentro. NO devuelve condiciones
   * médicas ni códigos: esto se guarda en el equipo para poder trabajar sin
   * conexión, y lo que se guarda en un equipo se pierde con el equipo.
   */
  async roster(c: PoolClient, salaId: string) {
    const { rows } = await c.query(
      /* ⛔ Pasa por la funcion, no por la vista: la funcion REGISTRA la
         lectura con su numero de filas. Una exportacion es una lectura de
         muchas filas, y eso es lo que convierte «nadie exporta menores» en
         algo comprobable en vez de una afirmacion. */
      `SELECT * FROM rocakids.roster_de_sala($1, 'censo de sala')`, [salaId]);
    return rows;
  }

  /** Quién está autorizado a entregar y a retirar a este menor. */
  async acudientes(c: PoolClient, menorId: string) {
    const { rows } = await c.query(
      `SELECT acudiente_id, acudiente, parentesco, autoriza_retiro
         FROM rocakids.v_acudientes_del_menor
        WHERE menor_id = $1
        ORDER BY autoriza_retiro DESC, acudiente`, [menorId]);
    if (!rows.length) {
      throw new BadRequestException(
        'Este menor no tiene ningún acudiente registrado. No se puede recibir hasta que la sede lo registre.');
    }
    return rows;
  }

  /**
   * Registrar la entrada.
   *
   * El código se devuelve UNA vez, aquí. Después solo existe cifrado en la
   * base, y ni el administrador puede leerlo.
   */
  async checkin(c: PoolClient, d: {
    menorId: string; salaId: string; entregadoPor: string; recibidoPor: string;
    servicioId?: string | null; anulacionDosAdultos?: string | null;
  }) {
    /* ⛔ 19 sep 2026 · Esto llamaba con CINCO argumentos y resolvía a la
       versión vieja de la función, la de antes de la salvaguarda: sin
       verificar que quien entrega sea acudiente vigente y sin la regla de
       los dos adultos. El banco probaba la versión de seis y el producto
       usaba la de cinco. La vieja se tumbó en la migración 0057. */
    const { rows } = await c.query(
      `SELECT * FROM rocakids.registrar_checkin($1,$2,$3,$4,$5,$6)`,
      [d.menorId, d.salaId, d.entregadoPor, d.recibidoPor, d.servicioId ?? null,
       d.anulacionDosAdultos ?? null]);
    const r = rows[0];
    if (r?.repetido) {
      /* Es la cola sin conexión reintentando. No es un error: es el mismo
         ingreso. Se dice claro para que la pantalla no pinte otro código. */
      return { checkinId: r.checkin_id, repetido: true, aviso: r.aviso ??
               'Ese menor ya estaba registrado hoy en esa sala. Se conserva el ingreso y el código original.' };
    }
    /* `aviso` puede traer el cambio de sala, el ingreso que se quedó sin
       salida la semana pasada o la anulación de los dos adultos. La
       pantalla lo muestra: un aviso que no se ve es un aviso que no existe. */
    return { checkinId: r.checkin_id, codigo: r.codigo, repetido: false, aviso: r.aviso ?? null };
  }

  /**
   * Entregar al menor.
   *
   * ⛔ La verificación la hace la base: acudiente autorizado Y código
   * correcto. Aquí solo se traduce el resultado a un mensaje en castellano.
   * Un intento fallido queda registrado, que es lo que convierte un
   * «alguien intentó llevarse a un niño» en un hecho con hora y nombre.
   */
  async entregar(c: PoolClient, d: { checkinId: string; retiradoPor: string; codigo: string; maestroId: string }) {
    const { rows } = await c.query(
      `SELECT rocakids.entregar_menor($1,$2,$3,$4) AS resultado`,
      [d.checkinId, d.retiradoPor, d.codigo, d.maestroId]);
    const r = rows[0]?.resultado as string;

    switch (r) {
      case 'entregado':        return { entregado: true, mensaje: 'Menor entregado.' };
      case 'ya_entregado':     throw new BadRequestException('Ese menor ya fue entregado.');
      case 'no_autorizado':    throw new ForbiddenException(
        'Esa persona no está autorizada para retirar a este menor. No se entrega, y el intento quedó registrado.');
      case 'codigo_incorrecto': throw new ForbiddenException(
        'El código no coincide. No se entrega, y el intento quedó registrado.');
      default:                 throw new BadRequestException(`No se pudo entregar: ${r}`);
    }
  }

  /** Quién está sirviendo en la sala, para la regla de dos adultos. */
  async servidores(c: PoolClient, salaId: string) {
    const { rows } = await c.query(
      `SELECT d.persona_id, trim(concat_ws(' ', p.primer_nombre, p.primer_apellido)) AS persona,
              d.entro_en, d.salio_en
         FROM rocakids.servidores_sala d
         JOIN nucleo.personas p ON p.id = d.persona_id
        WHERE d.sala_id = $1 AND d.fecha = CURRENT_DATE
        ORDER BY d.entro_en`, [salaId]);
    return rows;
  }

  /**
   * Entrar a servir. La base rechaza a quien no tenga antecedentes vigentes.
   *
   * ⛔ 20 de septiembre de 2026. Esto fallaba con 403 PARA TODO EL MUNDO,
   * incluido el Pastor Director General, y con ello se caía el domingo
   * entero: sin este paso ninguna sala llega nunca a dos adultos, y sin
   * dos adultos no se puede recibir a ningún niño.
   *
   * La causa era una línea: `ON CONFLICT ... DO UPDATE`. PostgreSQL exige
   * el privilegio UPDATE para esa cláusula Y LO COMPRUEBA AUNQUE NO HAYA
   * CONFLICTO, y la migración 0051 se lo revocó a la aplicación a
   * propósito, para que nadie pueda reescribir quién sirvió en una sala.
   *
   * Se conserva ese candado: el camino normal es un INSERT que no toca
   * nada, y la reentrada —el voluntario que salió y vuelve— va por una
   * función con guardia, gemela de `rocakids.salir_de_sala`.
   */
  async entrarASala(c: PoolClient, salaId: string, personaId: string) {
    const { rows } = await c.query(
      `INSERT INTO rocakids.servidores_sala (sala_id, persona_id, sede_id)
       SELECT $1, $2, sa.sede_id FROM rocakids.salas sa WHERE sa.id = $1
       ON CONFLICT (sala_id, persona_id, fecha) DO NOTHING
       RETURNING id`, [salaId, personaId]);
    if (rows[0]?.id) return { registrado: true, id: rows[0].id, reentrada: false };

    /* Ya estaba hoy en la sala: o sigue dentro, o salió y vuelve. */
    const { rows: [r] } = await c.query(
      `SELECT rocakids.volver_a_sala($1, $2) AS hecho`, [salaId, personaId]);
    return { registrado: true, ...r.hecho, reentrada: true };
  }
}
