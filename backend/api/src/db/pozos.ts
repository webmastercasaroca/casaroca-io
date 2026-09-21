/**
 * Tamaño de los pozos de conexión, en un solo sitio.
 *
 * ⛔ 19 de septiembre de 2026. El auditor de rendimiento midió lo que pasa
 * un domingo de 9 a 11, que es cuando 36 sedes registran asistencia y hacen
 * check-in de RocaKids casi a la vez, y encontró que el cuello no es una
 * consulta lenta: son las conexiones.
 *
 *   · El pozo de negocio tenía 10. Con 36 sedes a la vez, las peticiones no
 *     fallan: se ENCOLAN esperando conexión. Y se encolan justo en la
 *     pantalla de check-in, con la fila de niños delante.
 *   · El pozo de autenticación tenía 5, y es la PUERTA: toda petición con
 *     token pasa por él ANTES que por el de negocio. La entrada de la casa
 *     era más angosta que la casa.
 *   · El de autenticación no tenía `idle_in_transaction_session_timeout`:
 *     una transacción colgada se quedaba con una de esas cinco para siempre.
 *
 * Los números salen ahora de variables de entorno, porque el tamaño
 * correcto depende de cuántas instancias de la API corran: con dos
 * instancias son el doble de conexiones contra el mismo PostgreSQL, y
 * `max_connections` es finito. La regla: (negocio + auth + salud) x
 * instancias < max_connections - 10 de margen para el mantenimiento.
 */
const num = (nombre: string, porOmision: number) => {
  const v = Number(process.env[nombre]);
  return Number.isFinite(v) && v > 0 ? v : porOmision;
};

/** Transacciones de negocio. Es el que aguanta el pico del domingo. */
export const MAX_NEGOCIO = num('PG_POZO_NEGOCIO', 30);

/** Resolución de identidad. Va ANTES del de negocio en cada petición. */
export const MAX_AUTH = num('PG_POZO_AUTH', 15);

/** Sondas de salud. Pequeño a propósito: no debe competir con el tráfico. */
export const MAX_SALUD = num('PG_POZO_SALUD', 2);

/** Suma por instancia, para poder decirla en el arranque y en /salud. */
export const TOTAL_POR_INSTANCIA = MAX_NEGOCIO + MAX_AUTH + MAX_SALUD;
