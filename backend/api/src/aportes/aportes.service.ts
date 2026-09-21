import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { exigir } from '../comun/permiso';
import { DbService } from '../db/db.service';
import { contextoPublico } from '../contexto/contexto';

/**
 * Aportes y la pasarela.
 *
 * ⛔ El webhook NO confía en lo que le llega. PayU firma cada aviso con
 * MD5(ApiKey~merchantId~referenceCode~valor~moneda~estado). Sin firma
 * válida el aviso se GUARDA (por si hay disputa) pero no mueve dinero.
 * Un POST sin verificar es una puerta para que cualquiera declare
 * pagados los diezmos que quiera.
 */
@Injectable()
export class AportesService {
  constructor(private readonly db: DbService) {}

  /** Traduce el estado de PayU al nuestro. */
  private estadoDe(payu: string): string {
    const n = String(payu ?? '').toUpperCase();
    if (n === '4' || n === 'APPROVED')            return 'aprobada';
    if (n === '6' || n === 'DECLINED')            return 'rechazada';
    if (n === '5' || n === 'EXPIRED')             return 'expirada';
    if (n === '7' || n === 'PENDING')             return 'pendiente';
    return 'pendiente';
  }

  private firmaEsperada(b: any): string {
    const apiKey = process.env.PAYU_API_KEY ?? '';
    const merchant = process.env.PAYU_MERCHANT_ID ?? '';
    /* PayU exige el valor con UN decimal si el segundo es cero: 150000.00
       firma como 150000.0. Es el error clásico que hace que todas las
       firmas se vean inválidas sin motivo aparente. */
    const v = Number(b.TX_VALUE ?? b.value ?? 0);
    const valor = (Math.round(v * 10) / 10).toFixed(1);
    const cadena = [apiKey, merchant, b.reference_sale ?? b.referenceCode,
                    valor, b.currency, b.state_pol ?? b.state].join('~');
    return createHash('md5').update(cadena).digest('hex');
  }

  /**
   * La puerta del webhook. Pública por fuerza: la llama PayU, no un
   * usuario. Corre con contexto público y nivel 2; la promoción a aporte
   * la hace una función SECURITY DEFINER de la base.
   */
  async webhook(cuerpo: any, ip: string | null) {
    const referencia = cuerpo?.reference_sale ?? cuerpo?.referenceCode;
    if (!referencia) throw new BadRequestException('El aviso no trae referencia.');

    const recibida = String(cuerpo?.sign ?? cuerpo?.signature ?? '').toLowerCase();
    const valida = !!process.env.PAYU_API_KEY && recibida === this.firmaEsperada(cuerpo);
    /* Huella del aviso completo: el MISMO reenviado no entra dos veces. */
    const huella = createHash('sha256').update(JSON.stringify(cuerpo)).digest('hex');

    const sedeId = await this.sedeDeLaReferencia(referencia);

    return this.db.enTransaccion(contextoPublico(sedeId, ip), async (c) => {
      /* ⛔ TODO PASA POR FUNCIONES, NO POR INSERT/UPDATE DIRECTOS.
         El buzón es N3 y esta petición corre SIN usuario (la llama una
         máquina), así que no tiene ni puede tener nivel 3. La primera
         versión escribía la tabla a pelo y la base la rechazó:
           new row violates row-level security policy
         Bajar la RLS del buzón habría dejado leer los avisos de pago de
         toda la red a cualquier sesión de nivel 2. Se pasa por las
         puertas de la migración 0039, que hacen UNA acción concreta. */

      /* 1 · el aviso se guarda SIEMPRE, válido o no. Es la prueba. */
      const { rows: ev } = await c.query(
        `SELECT aportes.registrar_aviso_pasarela('payu',$1,$2,$3,$4::jsonb,$5,$6,$7) AS id`,
        [referencia, cuerpo?.transaction_id ?? null, String(cuerpo?.state_pol ?? ''),
         JSON.stringify(cuerpo), recibida, valida, huella]);

      const avisoId = ev[0]?.id;
      if (!avisoId) return { ok: true, repetido: true };   // ya lo habíamos recibido

      if (!valida) {
        await c.query(`SELECT aportes.cerrar_aviso_pasarela($1,$2)`,
          [avisoId, 'Firma inválida: el aviso se guarda pero no mueve dinero']);
        return { ok: false, motivo: 'firma_invalida' };
      }

      /* 2 · se pone al día la transacción */
      const estado = this.estadoDe(cuerpo?.state_pol);
      const { rows: trx } = await c.query(
        `SELECT aportes.actualizar_estado_pasarela($1,$2::aportes.estado_pasarela,$3,$4) AS id`,
        [referencia, estado, cuerpo?.transaction_id ?? null, cuerpo?.response_message_pol ?? null]);

      if (!trx[0]?.id) {
        await c.query(`SELECT aportes.cerrar_aviso_pasarela($1,$2)`,
          [avisoId, 'No existe una transacción con esa referencia']);
        return { ok: false, motivo: 'referencia_desconocida' };
      }

      /* 3 · y SOLO si quedó aprobada se contabiliza */
      let aporte = null;
      if (estado === 'aprobada') {
        const { rows } = await c.query(`SELECT aportes.confirmar_pago($1) AS aporte`, [trx[0].id]);
        aporte = rows[0]?.aporte ?? null;
      }
      await c.query(`SELECT aportes.cerrar_aviso_pasarela($1,NULL)`, [avisoId]);
      return { ok: true, estado, aporte, sin_dueno: estado === 'aprobada' && !aporte };
    });
  }

  private async sedeDeLaReferencia(ref: string): Promise<string> {
    const c = await (this.db as any).pool.connect();
    try {
      const { rows } = await c.query(
        `SELECT sede_id FROM aportes.pasarela_transacciones WHERE referencia = $1`, [ref]);
      if (rows.length) return rows[0].sede_id;
      const { rows: s } = await c.query(`SELECT id FROM org.sedes WHERE activa ORDER BY creado_en LIMIT 1`);
      return s[0]?.id;
    } finally { c.release(); }
  }

  /** Lo que hay que mirar cada día: dinero que entró y no tiene ficha. */
  async sinDueno(c: PoolClient) {
    /* ⛔ Faltaba el candado de ACCIÓN. La RLS decide qué filas se ven;
       esto decide quién puede ejecutar la operación. Sin él, cualquier
       rol con nivel 3 (AUDITOR, CONTABILIDAD, TALENTO_HUMANO) tocaba el
       dinero sin tener el permiso de tesorería. */
    await exigir(c, 'aportes', 'ver');
    const { rows } = await c.query(`SELECT * FROM aportes.v_pagos_sin_dueno ORDER BY confirmada_en`);
    return rows;
  }

  /** Emparejar a mano lo que el automático no pudo. */
  async emparejar(c: PoolClient, trxId: string, personaId: string) {
    /* ⛔ Faltaba el candado de ACCIÓN. La RLS decide qué filas se ven;
       esto decide quién puede ejecutar la operación. Sin él, cualquier
       rol con nivel 3 (AUDITOR, CONTABILIDAD, TALENTO_HUMANO) tocaba el
       dinero sin tener el permiso de tesorería. */
    await exigir(c, 'aportes', 'editar');
    await c.query(
      `UPDATE aportes.pasarela_transacciones SET persona_id=$2, actualizada_en=now() WHERE id=$1`,
      [trxId, personaId]);
    const { rows } = await c.query(`SELECT aportes.confirmar_pago($1) AS aporte`, [trxId]);
    return { ok: true, aporte: rows[0]?.aporte ?? null };
  }
}
