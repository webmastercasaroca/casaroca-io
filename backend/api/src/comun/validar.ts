import { BadRequestException } from '@nestjs/common';

/**
 * Validación de entrada, sin dependencias.
 *
 * ⛔ HALLAZGO H-07: seis módulos aceptaban lo que llegara. Sin validación,
 * el primer error aparece en la base, con un mensaje del motor que ni el
 * usuario entiende ni el soporte puede rastrear, o no aparece y se guarda
 * basura.
 *
 * La regla: lo que no se declara, no entra. Y el mensaje de error dice qué
 * hacer, en castellano, sin filtrar la estructura interna.
 */
export function texto(v: unknown, campo: string,
  o: { min?: number; max?: number; patron?: RegExp; sinRecortar?: boolean } = {}): string {
  if (typeof v !== 'string') throw new BadRequestException(`«${campo}» debe ser texto.`);
  const s = o.sinRecortar ? v : v.trim();
  if (o.min !== undefined && s.length < o.min) throw new BadRequestException(`«${campo}» debe tener al menos ${o.min} caracteres.`);
  if (o.max !== undefined && s.length > o.max) throw new BadRequestException(`«${campo}» no puede pasar de ${o.max} caracteres.`);
  if (o.patron && !o.patron.test(s)) throw new BadRequestException(`«${campo}» no tiene el formato esperado.`);
  return s;
}

export function textoOpcional(v: unknown, campo: string, o: Parameters<typeof texto>[2] = {}): string | null {
  if (v === undefined || v === null || v === '') return null;
  return texto(v, campo, o);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuid(v: unknown, campo: string): string {
  const s = texto(v, campo, { min: 36, max: 36 });
  if (!UUID.test(s)) throw new BadRequestException(`«${campo}» no es un identificador válido.`);
  return s;
}
export function uuidOpcional(v: unknown, campo: string): string | null {
  if (v === undefined || v === null || v === '') return null;
  return uuid(v, campo);
}

export function entero(v: unknown, campo: string, o: { min?: number; max?: number } = {}): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n)) throw new BadRequestException(`«${campo}» debe ser un número entero.`);
  if (o.min !== undefined && n < o.min) throw new BadRequestException(`«${campo}» no puede ser menor que ${o.min}.`);
  if (o.max !== undefined && n > o.max) throw new BadRequestException(`«${campo}» no puede ser mayor que ${o.max}.`);
  return n;
}

/** Dinero: nunca en coma flotante, y nunca negativo por descuido. */
export function monto(v: unknown, campo: string): string {
  const s = String(v ?? '').trim();
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(s)) throw new BadRequestException(`«${campo}» debe ser un monto válido, con máximo dos decimales.`);
  return s;
}

export function fecha(v: unknown, campo: string): string {
  const s = texto(v, campo, { min: 10, max: 10, patron: /^\d{4}-\d{2}-\d{2}$/ });
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`«${campo}» no es una fecha válida (use AAAA-MM-DD).`);
  return s;
}

export function booleano(v: unknown, campo: string): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 'false') return v === 'true';
  throw new BadRequestException(`«${campo}» debe ser verdadero o falso.`);
}

export function unoDe<T extends string>(v: unknown, campo: string, valores: readonly T[]): T {
  const s = texto(v, campo, { min: 1, max: 100 });
  if (!(valores as readonly string[]).includes(s)) {
    throw new BadRequestException(`«${campo}» debe ser uno de: ${valores.join(', ')}.`);
  }
  return s as T;
}

/** Paginación: ninguna lista se devuelve abierta (checklist B7.06). */
export function paginacion(q: any): { limite: number; desde: number } {
  const limite = q?.limite === undefined ? 50 : entero(q.limite, 'limite', { min: 1, max: 200 });
  const desde  = q?.desde  === undefined ? 0  : entero(q.desde,  'desde',  { min: 0, max: 1_000_000 });
  return { limite, desde };
}
