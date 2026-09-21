/**
 * La cola de lo que no se pudo enviar.
 *
 * ⛔ POR QUÉ EXISTE: el pico del sistema es el domingo a las 10, con 2.500
 * niños entrando a sus salas, y el wifi del templo es exactamente lo que
 * falla a esa hora. Un check-in que depende de la red es un check-in que un
 * domingo no ocurre, y entonces la sala vuelve al papel.
 *
 * ⛔ LOS CUATRO FALLOS QUE LA AUDITORÍA INTERNA DEL 19 DE SEPTIEMBRE
 *    REPRODUJO EN EL NAVEGADOR, Y QUE ESTA VERSIÓN CIERRA:
 *
 *  1 · Lo rechazado con 4xx se DESCARTABA y la pantalla decía «Todo
 *      enviado». Cuarenta check-ins podían volverse cero filas con un
 *      letrero verde. Ahora lo rechazado va a una lista PERSISTENTE que se
 *      pinta fija en pantalla, con el nombre del niño y el motivo.
 *
 *  2 · `vaciar()` leía la cola al empezar y la reescribía entera al
 *      terminar, PISANDO todo lo que se hubiera encolado en medio. Con wifi
 *      lento, cada niño registrado mientras se enviaba el anterior se
 *      borraba. Ahora cada operación se saca por su identificador, sobre
 *      una lectura fresca, y hay candado entre pestañas.
 *
 *  3 · Si `localStorage` fallaba (cuota llena, Safari privado), se tragaba
 *      el error: se entregaba el comprobante y el registro no se guardaba
 *      ni se enviaba. Ahora `encolar` FALLA y la pantalla bloquea.
 *
 *  4 · La cola era del EQUIPO, no de la persona: el siguiente voluntario la
 *      vaciaba con su token y la entrada de un menor quedaba firmada por
 *      quien no la hizo. Ahora cada operación guarda quién la creó y no se
 *      envía con otra identidad.
 */
const LLAVE = 'cr.cola';
const LLAVE_RECHAZADOS = 'cr.rechazados';
const MAX_INTENTOS = 8;

function leer(llave = LLAVE) {
  try { const v = JSON.parse(localStorage.getItem(llave) ?? '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

/** Devuelve si de verdad se guardó. Quien llama TIENE que mirarlo. */
function escribir(lista, llave = LLAVE) {
  try {
    localStorage.setItem(llave, JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}

function avisarCambio() {
  window.dispatchEvent(new CustomEvent('cr:cola-cambio'));
}

/** Candado entre pestañas. Sin él, dos pestañas vacían la misma cola a la vez. */
async function conCandado(fn) {
  if (navigator.locks?.request) {
    return navigator.locks.request('cr.cola', { mode: 'exclusive' }, fn);
  }
  /* Navegador sin Web Locks: candado pobre en localStorage con caducidad,
     para no quedarse bloqueado si una pestaña se cierra a media faena. */
  const ahora = Date.now();
  const tomado = Number(localStorage.getItem('cr.cola.candado') ?? 0);
  if (tomado && ahora - tomado < 30_000) return { enviados: 0, rechazados: [], ocupado: true, respuestas: {} };
  localStorage.setItem('cr.cola.candado', String(ahora));
  try { return await fn(); }
  finally { localStorage.removeItem('cr.cola.candado'); }
}

export class ColaLlenaError extends Error {
  constructor() {
    super('Este equipo no puede guardar más registros: la memoria del navegador está llena. ' +
          'Use otro equipo o libere espacio antes de seguir registrando.');
  }
}

export const cola = {
  pendientes: () => leer().length,
  rechazados: () => leer(LLAVE_RECHAZADOS),

  /**
   * Encola y devuelve la operación guardada.
   * ⛔ LANZA si no se pudo guardar. Nunca se entrega un comprobante por algo
   *    que no quedó escrito.
   */
  encolar(operacion, quien) {
    const op = {
      ...operacion,
      id: crypto.randomUUID(),          // sirve de clave de idempotencia
      encolado_en: new Date().toISOString(),
      intentos: 0,
      persona_id: quien?.personaId ?? null,
      usuario: quien?.usuario ?? null,
    };
    const c = leer();
    c.push(op);
    if (!escribir(c)) throw new ColaLlenaError();
    avisarCambio();
    return op;
  },

  olvidarRechazado(id) {
    escribir(leer(LLAVE_RECHAZADOS).filter(x => x.op.id !== id), LLAVE_RECHAZADOS);
    avisarCambio();
  },

  /** Devuelve un rechazado a la cola, para reintentar tras corregir. */
  reintentarRechazado(id) {
    const r = leer(LLAVE_RECHAZADOS);
    const x = r.find(y => y.op.id === id);
    if (!x) return false;
    escribir(r.filter(y => y.op.id !== id), LLAVE_RECHAZADOS);
    const c = leer();
    c.push({ ...x.op, intentos: 0 });
    if (!escribir(c)) throw new ColaLlenaError();
    avisarCambio();
    return true;
  },

  /**
   * Envía lo pendiente.
   *
   * ⛔ Cada operación se saca de la cola LEYÉNDOLA FRESCA y filtrando por su
   *    identificador. Nunca se reescribe la cola entera: eso es lo que
   *    borraba lo que se encolaba mientras tanto.
   */
  async vaciar(enviar, quien) {
    return conCandado(async () => {
      const inicial = leer();
      if (!inicial.length) return { enviados: 0, rechazados: [], ocupado: false, respuestas: {} };

      let enviados = 0;
      const rechazados = [];
      /* ⛔ 20 sep 2026. Aquí se hacía `await enviar(op)` y se TIRABA lo que
         contestaba el servidor. En RocaKids esa respuesta trae el CÓDIGO DE
         ENTREGA del niño, que el servidor genera una sola vez: sin él, el
         acudiente no puede retirar a su hijo y el domingo no se cierra
         desde la aplicación. La pantalla leía `op.codigo`, que no existe en
         la operación encolada, así que SIEMPRE caía al mensaje de «aparecerá
         cuando vuelva la conexión» y no aparecía nunca. */
      const respuestas = {};

      for (const op of inicial) {
        /* ⛔ No se envía con la identidad de otro. Si la cola la dejó otro
           voluntario, se queda ahí hasta que él entre. */
        if (op.persona_id && quien?.personaId && op.persona_id !== quien.personaId) continue;

        try {
          respuestas[op.id] = await enviar(op);
          enviados++;
          escribir(leer().filter(x => x.id !== op.id));
        } catch (e) {
          const esDelServidor = e?.estado >= 400 && e?.estado < 500;
          if (esDelServidor) {
            /* El servidor lo rechaza: reintentar mil veces solo esconde el
               problema. Pero NO se tira: se guarda con su motivo para que
               alguien lo vea y lo corrija. */
            const r = leer(LLAVE_RECHAZADOS);
            r.push({ op, motivo: e.message, estado: e.estado, rechazado_en: new Date().toISOString() });
            escribir(r, LLAVE_RECHAZADOS);
            escribir(leer().filter(x => x.id !== op.id));
            rechazados.push({ op, motivo: e.message });
          } else {
            /* Fallo de red o del servidor: se reintenta, con tope. */
            const c = leer();
            const i = c.findIndex(x => x.id === op.id);
            if (i >= 0) {
              c[i].intentos = (c[i].intentos ?? 0) + 1;
              c[i].ultimo_error = String(e?.message ?? e).slice(0, 200);
              if (c[i].intentos >= MAX_INTENTOS) {
                const r = leer(LLAVE_RECHAZADOS);
                r.push({ op: c[i], motivo: `No se pudo enviar tras ${MAX_INTENTOS} intentos: ${c[i].ultimo_error}`,
                         estado: 0, rechazado_en: new Date().toISOString() });
                escribir(r, LLAVE_RECHAZADOS);
                c.splice(i, 1);
                rechazados.push({ op, motivo: 'agotó los reintentos' });
              }
              escribir(c);
            }
            break;   // sin red, no tiene sentido seguir con los demás
          }
        }
      }

      avisarCambio();
      return { enviados, rechazados, ocupado: false, respuestas };
    });
  },
};

export function vigilarConexion(alCambiar) {
  const avisar = () => alCambiar(navigator.onLine);
  window.addEventListener('online', avisar);
  window.addEventListener('offline', avisar);
  /* Otra pestaña tocó la cola: este contador estaba quedándose viejo. */
  window.addEventListener('storage', (ev) => {
    if (ev.key === LLAVE || ev.key === LLAVE_RECHAZADOS) avisarCambio();
  });
  avisar();
}

/* ── Memoria local de catálogos, para trabajar sin conexión ───────────
   Lo que se guarda aquí es lo MÍNIMO para que la sala funcione: nombres,
   edades e identificadores. ⛔ Nunca condiciones médicas ni códigos: lo que
   se guarda en un equipo se pierde con el equipo. */
export const memoria = {
  guardar(clave, datos) {
    try {
      localStorage.setItem('cr.mem.' + clave,
        JSON.stringify({ en: new Date().toISOString(), datos }));
      return true;
    } catch { return false; }
  },
  leer(clave) {
    try {
      const v = JSON.parse(localStorage.getItem('cr.mem.' + clave) ?? 'null');
      return v?.datos ?? null;
    } catch { return null; }
  },
  cuando(clave) {
    try { return JSON.parse(localStorage.getItem('cr.mem.' + clave) ?? 'null')?.en ?? null; }
    catch { return null; }
  },
  olvidarTodo() {
    for (const k of Object.keys(localStorage)) if (k.startsWith('cr.mem.')) localStorage.removeItem(k);
  },
};
