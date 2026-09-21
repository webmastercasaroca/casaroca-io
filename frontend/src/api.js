/**
 * El cliente de la API.
 *
 * ⛔ 19 sep 2026 · Lo que cambió. El prototipo mandaba la identidad en la
 * cabecera `X-Persona-Id`, leída de `localStorage`. Un permiso que se puede
 * editar con el inspector del navegador no es un permiso. Ahora va un token
 * firmado, se renueva solo, y si la base dice que la sesión murió, se cae la
 * sesión aquí también: la verdad está en el servidor.
 */
import { demoActivo, responderDemo } from './demo.js';

const BASE = window.CASAROCA_API ?? 'http://127.0.0.1:3000';
const LLAVE_ACCESO = 'cr.acceso';
const LLAVE_REFRESCO = 'cr.refresco';

/* ⛔ Los tokens viven en memoria y se espejan en sessionStorage, no en
   localStorage: sessionStorage muere al cerrar la pestaña, que es lo que
   uno espera de una sesión en un computador compartido de recepción. */
let acceso = sessionStorage.getItem(LLAVE_ACCESO) ?? null;
let refresco = sessionStorage.getItem(LLAVE_REFRESCO) ?? null;
let renovando = null;

export const hayTokens = () => !!acceso;

export function guardarTokens(t) {
  acceso = t?.acceso ?? null; refresco = t?.refresco ?? null;
  if (acceso) sessionStorage.setItem(LLAVE_ACCESO, acceso); else sessionStorage.removeItem(LLAVE_ACCESO);
  if (refresco) sessionStorage.setItem(LLAVE_REFRESCO, refresco); else sessionStorage.removeItem(LLAVE_REFRESCO);
}

export function borrarTokens() { guardarTokens(null); }

export class ErrorApi extends Error {
  constructor(mensaje, estado, peticionId, datos) {
    super(mensaje); this.estado = estado; this.peticionId = peticionId; this.datos = datos;
  }
}

async function crudo(ruta, opciones = {}, reintentar = true) {
  /* ⛔ MODO DEMOSTRACIÓN. No se enciende solo: hace falta `?demo=1` o
     `window.CASAROCA_DEMO`. Cuando está encendido NADA sale de esta
     pestaña, y la aplicación lo avisa arriba en todas las pantallas. */
  if (demoActivo()) return responderDemo(ruta, opciones);

  const cabeceras = { 'Content-Type': 'application/json', ...(opciones.headers ?? {}) };
  if (acceso) cabeceras.Authorization = `Bearer ${acceso}`;

  let r;
  try {
    r = await fetch(BASE + ruta, { ...opciones, headers: cabeceras });
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Revise su red e inténtelo otra vez.', 0, null);
  }

  /* 401 con token: se intenta renovar UNA vez. Si el refresco tampoco
     sirve, la sesión murió de verdad (la cerraron, venció, o se revocó). */
  if (r.status === 401 && reintentar && refresco) {
    if (!renovando) {
      renovando = fetch(BASE + '/api/v1/auth/refrescar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresco }),
      }).then(async res => {
        if (!res.ok) throw new Error('refresco rechazado');
        guardarTokens(await res.json());
      }).finally(() => { renovando = null; });
    }
    try { await renovando; return crudo(ruta, opciones, false); }
    catch { borrarTokens(); window.dispatchEvent(new CustomEvent('cr:sesion-caida')); }
  }

  const peticionId = r.headers.get('X-Peticion-Id');
  let cuerpo = null;
  try { cuerpo = await r.json(); } catch { /* sin cuerpo */ }

  if (!r.ok) {
    const mensaje = cuerpo?.mensaje ?? cuerpo?.message ?? `Error ${r.status}`;
    throw new ErrorApi(mensaje, r.status, peticionId, cuerpo);
  }
  return cuerpo;
}

export const api = {
  obtener: (ruta) => crudo(ruta),
  enviar:  (ruta, datos) => crudo(ruta, { method: 'POST', body: JSON.stringify(datos ?? {}) }),
  cambiar: (ruta, datos) => crudo(ruta, { method: 'PUT',  body: JSON.stringify(datos ?? {}) }),
  /* ⛔ Un DELETE con cuerpo. No es un capricho: revocar un rol exige el
     MOTIVO por escrito, y sin esto la consola no tenía por dónde
     mandarlo (el motivo se pedía en pantalla y se tiraba a la basura). */
  borrar:  (ruta, datos) => crudo(ruta,
    datos === undefined ? { method: 'DELETE' }
                        : { method: 'DELETE', body: JSON.stringify(datos) }),
  base: BASE,
};
