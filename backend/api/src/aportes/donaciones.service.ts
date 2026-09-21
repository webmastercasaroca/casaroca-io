import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { contextoActual } from '../contexto/contexto';
import { exigir } from '../comun/permiso';

/**
 * Módulo de Donaciones (documento «ESTRUCTURA DE DATOS - DONACIONES» del
 * Drive 100p): registrar, aprobar, consultar, certificar y anular.
 *
 * ⛔ Digitar y aprobar son manos distintas. El documento lo dice del rol
 *    (DIGITADOR_APORTES «no aprueba»); aquí además se cierra el caso de
 *    una misma persona con los dos roles: nadie confirma lo que digitó.
 * ⛔ Las reglas duras (aporte certificado inmutable, certificado de una
 *    sola sede y moneda, anular con motivo) viven en la base. Aquí solo
 *    se traducen sus errores a algo que Tesorería entienda.
 */
@Injectable()
export class DonacionesService {

  /** Caso 2 del documento: la consulta de Tesorería con filtros. */
  async listar(c: PoolClient, f: { anio?: string; tipo?: string; estado?: string; persona_id?: string; limite?: string }) {
    await exigir(c, 'aportes', 'ver');
    const { rows } = await c.query(
      `SELECT d.id, p.documento, p.nombre_completo, d.tipo_aporte, d.monto, d.moneda,
              d.fecha_aporte, d.metodo_pago, d.estado, d.inmutable, d.fuente,
              d.certificado_id, d.referencia, d.sede_id
         FROM modelo100p.donaciones d
         LEFT JOIN modelo100p.personas p ON p.id = d.persona_id
        WHERE ($1::int  IS NULL OR extract(year FROM d.fecha_aporte) = $1::int)
          AND ($2::text IS NULL OR d.tipo_aporte = upper($2))
          AND ($3::text IS NULL OR d.estado = upper($3))
          AND ($4::uuid IS NULL OR d.persona_id = $4::uuid)
        ORDER BY d.fecha_aporte DESC, d.fecha_registro DESC
        LIMIT $5`,
      [f.anio ?? null, f.tipo ?? null, f.estado ?? null, f.persona_id ?? null,
       Math.min(Number(f.limite) || 200, 1000)]);
    const total = rows.reduce((s, r) => s + Number(r.monto), 0);
    return { total_filas: rows.length, total_monto: total, donaciones: rows };
  }

  /** Ejemplo 1 del documento: registro manual en casaroca.io. */
  async registrar(c: PoolClient, d: any) {
    await exigir(c, 'aportes', 'REGISTRAR_APORTE');
    const ctx = contextoActual();
    if (!d?.persona_id && !d?.es_anonimo) {
      throw new BadRequestException('Una donación va a nombre de una persona, o se declara anónima.');
    }
    const monto = Number(d?.monto);
    if (!(monto > 0)) throw new BadRequestException('El monto debe ser mayor que cero.');

    // La sede sale de la persona, no del cliente: así el aporte cuadra con
    // el cierre de la sede donde la persona congrega.
    let sedeId: string | undefined = d.sede_id;
    if (d.persona_id) {
      const { rows: [p] } = await c.query(`SELECT sede_id FROM nucleo.personas WHERE id = $1`, [d.persona_id]);
      if (!p) throw new NotFoundException('No existe esa persona, o no pertenece a su sede.');
      sedeId = p.sede_id;
    }
    if (!sedeId) throw new BadRequestException('Un aporte anónimo necesita la sede que lo recibió.');

    const tipo = String(d.tipo_aporte ?? 'diezmo').toLowerCase();
    const fondoCodigo = d.fondo ?? (tipo === 'diezmo' ? 'DIEZMOS' : 'GENERAL');
    try {
      const { rows: [a] } = await c.query(
        `INSERT INTO aportes.aportes
           (sede_id, persona_id, es_anonimo, fondo_id, tipo, monto, moneda, medio, fecha,
            referencia, registrado_por, fuente)
         SELECT $1, $2, $3, f.id, $4, $5, COALESCE($6,'COP'),
                $7, COALESCE($8::date, CURRENT_DATE), $9, $10, 'manual'
           FROM aportes.fondos f WHERE f.codigo = $11
         RETURNING id, estado, fecha`,
        [sedeId, d.persona_id ?? null, !d.persona_id, tipo, monto, d.moneda ?? null,
         String(d.metodo_pago ?? 'efectivo').toLowerCase(), d.fecha_aporte ?? null,
         d.referencia ?? null, ctx.personaId, fondoCodigo]);
      if (!a) throw new BadRequestException(`No existe el fondo «${fondoCodigo}».`);
      return { id: a.id, estado: String(a.estado).toUpperCase(), fecha_aporte: a.fecha, mensaje: 'Donación registrada' };
    } catch (e: any) {
      /* ⛔ 19 sep 2026 · Estas dos columnas eran `enum` y se convirtieron en
         catálogo editable (migración 0046): el cast `::aportes.tipo_aporte`
         quedó apuntando a un tipo BORRADO y TODA donación devolvía un 500.
         Ahora son texto validado por disparador, que avisa con otros códigos. */
      if (e.code === '22P02') throw new BadRequestException('Tipo de aporte o método de pago no válido.');
      if (e.code === '23503') throw new BadRequestException('Valor fuera del catálogo: ' + e.message);
      if (e.code === '23514') throw new BadRequestException('La donación no cumple las reglas: ' + e.message);
      throw e;
    }
  }

  /** «APROBAR_APORTE» del documento = confirmar contra el extracto o la pasarela. */
  async confirmar(c: PoolClient, id: string) {
    await exigir(c, 'aportes', 'APROBAR_APORTE');
    const ctx = contextoActual();
    const { rows: [a] } = await c.query(
      `SELECT estado, registrado_por, anulado_en FROM aportes.aportes WHERE id = $1`, [id]);
    if (!a) throw new NotFoundException('No existe esa donación, o no pertenece a su sede.');
    if (a.anulado_en) throw new ConflictException('La donación está anulada.');
    if (a.estado !== 'registrado') throw new ConflictException(`La donación ya está ${a.estado}.`);
    if (a.registrado_por && a.registrado_por === ctx.personaId) {
      throw new ConflictException('Quien digitó la donación no puede aprobarla: son manos distintas.');
    }
    await c.query(`UPDATE aportes.aportes SET estado = 'confirmado' WHERE id = $1`, [id]);
    return { id, estado: 'CONFIRMADO' };
  }

  /** Ejemplo 2 del documento: expedición del certificado del período. */
  async expedirCertificado(c: PoolClient, d: any) {
    await exigir(c, 'aportes', 'GENERAR_CERTIFICADO');
    const ctx = contextoActual();
    if (!d?.persona_id) throw new BadRequestException('Falta la persona del certificado.');
    const anio = Number(d.anio) || new Date().getFullYear();
    const desde = d.fecha_inicio ?? `${anio}-01-01`;
    const hasta = d.fecha_fin ?? `${anio}-12-31`;

    // Numeración CERT-AAAA-SEDE-NNNN. Va por sede porque cada sede solo ve
    // sus certificados: contar entre todas daría números repetidos. El
    // número es único en la base; si dos tesoreros expiden a la vez, el
    // segundo reintenta con el siguiente.
    const { rows: [sede] } = await c.query(
      `SELECT s.codigo FROM nucleo.personas p JOIN org.sedes s ON s.id = p.sede_id WHERE p.id = $1`,
      [d.persona_id]);
    if (!sede) throw new NotFoundException('No existe esa persona, o no pertenece a su sede.');
    const prefijo = `CERT-${anio}-${sede.codigo}-`;
    for (let intento = 0; intento < 3; intento++) {
      const { rows: [n] } = await c.query(
        `SELECT $1 || lpad((count(*) + 1 + $2)::text, 4, '0') AS numero
           FROM aportes.certificados WHERE numero LIKE $1 || '%'`, [prefijo, intento]);
      await c.query('SAVEPOINT expedir');
      try {
        const { rows: [r] } = await c.query(
          `SELECT aportes.expedir_certificado($1, $2::date, $3::date, $4, $5) AS id`,
          [d.persona_id, desde, hasta, n.numero, ctx.personaId]);
        await c.query(`UPDATE aportes.certificados SET url_pdf = $2 WHERE id = $1`,
          [r.id, `/api/v1/aportes/certificados/${r.id}/documento`]);
        await c.query('RELEASE SAVEPOINT expedir');
        return this.certificado(c, r.id);
      } catch (e: any) {
        await c.query('ROLLBACK TO SAVEPOINT expedir');
        if (e.code === '23505' && intento < 2) continue;
        if (e.code === '02000' || e.code === 'P0002') throw new NotFoundException(e.message);
        if (e.code === '23514') throw new ConflictException(e.message);
        throw e;
      }
    }
    throw new ConflictException('No se pudo asignar un número de certificado. Intente de nuevo.');
  }

  async certificado(c: PoolClient, id: string) {
    await exigir(c, 'aportes', 'ver');
    const { rows: [cert] } = await c.query(`SELECT * FROM modelo100p.certificados WHERE id = $1`, [id]);
    if (!cert) throw new NotFoundException('No existe ese certificado, o no está a su alcance.');
    return cert;
  }

  async anularCertificado(c: PoolClient, id: string, motivo: string) {
    await exigir(c, 'aportes', 'ANULAR_CERTIFICADO');
    const ctx = contextoActual();
    try {
      const { rows: [r] } = await c.query(
        `SELECT aportes.anular_certificado($1, $2, $3) AS liberados`, [id, motivo ?? null, ctx.personaId]);
      return { id, estado: 'ANULADO', aportes_liberados: r.liberados };
    } catch (e: any) {
      if (e.code === '02000' || e.code === 'P0002') throw new NotFoundException(e.message);
      if (e.code === '23514') throw new BadRequestException(e.message);
      throw e;
    }
  }

  /**
   * El certificado como documento imprimible. El navegador lo guarda como
   * PDF («Imprimir → Guardar como PDF»); en producción un Cloud Run Job lo
   * renderiza a PDF en el bucket de certificados (ver infra/gcp).
   */
  async documento(c: PoolClient, id: string): Promise<string> {
    const cert = await this.certificado(c, id);
    const { rows: [p] } = await c.query(
      `SELECT nombre_completo, documento, tipo_documento FROM modelo100p.personas WHERE id = $1`,
      [cert.persona_id]);
    const { rows: [s] } = await c.query(`SELECT nombre, ciudad FROM org.sedes WHERE id = $1`, [cert.sede_id]);
    const { rows: detalle } = await c.query(
      `SELECT fecha_aporte, tipo_aporte, metodo_pago, monto FROM modelo100p.donaciones
        WHERE certificado_id = $1 ORDER BY fecha_aporte`, [id]);
    const dinero = (v: any) => Number(v).toLocaleString('es-CO', { minimumFractionDigits: 2 });
    const anulado = cert.estado === 'ANULADO';
    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(cert.numero_certificado)}</title>
<style>
  body{font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#1a1a1a;padding:0 16px}
  h1{font-size:20px;letter-spacing:.04em;text-transform:uppercase;margin:0 0 4px}
  .sub{color:#555;margin:0 0 28px} table{width:100%;border-collapse:collapse;margin:20px 0}
  td,th{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left;font-size:14px}
  td.v,th.v{text-align:right} .total{font-weight:bold;font-size:16px}
  .anulado{border:3px solid #b00020;color:#b00020;padding:8px;text-align:center;font-weight:bold;margin-bottom:20px}
  @media print{.nover{display:none}}
</style></head><body>
${anulado ? `<div class="anulado">CERTIFICADO ANULADO · ${esc(cert.motivo_anulacion)}</div>` : ''}
<h1>Certificado de donación</h1>
<p class="sub">Casa Sobre la Roca · ${esc(s?.nombre)} · N.º ${esc(cert.numero_certificado)}</p>
<p>Se certifica que <strong>${esc(p?.nombre_completo)}</strong>${p?.documento ? `, identificado(a) con ${esc(p.tipo_documento)} ${esc(p.documento)},` : ''}
realizó aportes a la iglesia entre el <strong>${fecha(cert.fecha_inicio)}</strong> y el <strong>${fecha(cert.fecha_fin)}</strong>
por un total de <strong>${esc(cert.moneda)} ${dinero(cert.total_certificado)}</strong>, en ${cert.cantidad_aportes} aporte(s).</p>
<table><tr><th>Fecha</th><th>Tipo</th><th>Medio</th><th class="v">Monto</th></tr>
${detalle.map(r => `<tr><td>${fecha(r.fecha_aporte)}</td><td>${esc(r.tipo_aporte)}</td><td>${esc(r.metodo_pago)}</td><td class="v">${dinero(r.monto)}</td></tr>`).join('')}
<tr class="total"><td colspan="3">Total</td><td class="v">${dinero(cert.total_certificado)}</td></tr></table>
<p>Expedido en ${esc(s?.ciudad)} el ${fecha(cert.fecha_expedicion, true)}.</p>
<p class="nover"><button onclick="print()">Imprimir o guardar como PDF</button></p>
</body></html>`;
  }
}

function esc(v: any): string {
  return String(v ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[ch]);
}
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
               'septiembre','octubre','noviembre','diciembre'];
/**
 * ⛔ `pg` entrega un DATE como medianoche en la zona del SERVIDOR. En Cloud
 *    Run el servidor está en UTC, y convertir esa medianoche a Bogotá la
 *    corre al día anterior: un certificado diría 31 de diciembre donde
 *    dice 1 de enero. Las fechas se leen con los componentes locales; solo
 *    los instantes (`conHora`) se pasan a la hora de Bogotá.
 */
function fecha(v: any, conHora = false): string {
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return esc(v);
  if (conHora) return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Bogota' });
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}
