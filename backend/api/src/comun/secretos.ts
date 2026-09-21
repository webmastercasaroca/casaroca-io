import { Logger } from '@nestjs/common';

/**
 * De dónde salen los secretos, y qué pasa si no salen de donde deben.
 *
 * ⛔ HALLAZGO H-08 DE LA AUDITORÍA: la llave que cifra los datos de nivel
 * crítico (incluidos los códigos de entrega de los menores) salía de una
 * variable de entorno con un valor de desarrollo escrito en el repositorio.
 * Quien viera el entorno del proceso descifraba esos datos.
 *
 * ⭐ LA REGLA QUE ESTE ARCHIVO IMPONE: en producción, la aplicación NO
 * ARRANCA si un secreto viene de un valor de desarrollo o si falta. No
 * avisa en un log que nadie lee: se niega a levantar. Un sistema que
 * arranca con una llave de juguete es peor que uno que no arranca, porque
 * parece que funciona.
 *
 * En Cloud Run, los secretos se montan desde Secret Manager como variables
 * de entorno del servicio; la llave de cifrado se envuelve con KMS
 * (ver infra/gcp/kms.tf y docs/RUNBOOK.md).
 */
const log = new Logger('Secretos');

const VALORES_DE_JUGUETE = new Set([
  'llave-solo-de-desarrollo', 'cambiar', 'secreto', 'dev', 'test', 'changeme', '',
]);

export const enProduccion = () => (process.env.NODE_ENV ?? 'development') === 'production';

export function secretoObligatorio(nombre: string, minimo = 32): string {
  const v = process.env[nombre] ?? '';
  if (enProduccion()) {
    if (!v || VALORES_DE_JUGUETE.has(v) || v.length < minimo) {
      throw new Error(
        `El secreto ${nombre} falta, es de desarrollo o es demasiado corto (mínimo ${minimo}). ` +
        `En producción debe venir del gestor de secretos. La aplicación no arranca así.`,
      );
    }
    return v;
  }
  if (!v) {
    log.warn(`${nombre} no está definido: se usa un valor de DESARROLLO. Jamás en producción.`);
    return `desarrollo-${nombre}-no-usar-en-produccion-0000000000`;
  }
  return v;
}

export function revisarSecretosAlArrancar(): void {
  secretoObligatorio('APP_JWT_SECRETO');
  secretoObligatorio('APP_LLAVE_N4');
  if (enProduccion() && !process.env.CORS_ORIGENES) {
    throw new Error('CORS_ORIGENES es obligatorio en producción: una API con datos N3 y N4 no acepta cualquier origen.');
  }
  log.log(`Secretos verificados · entorno ${process.env.NODE_ENV ?? 'development'}`);
}
