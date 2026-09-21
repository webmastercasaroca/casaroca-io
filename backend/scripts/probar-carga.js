#!/usr/bin/env node
/**
 * Prueba de carga del DOMINGO.
 *
 * ⛔ Por qué existe (checklist B0.04 y B11.13): el sistema se estrena en su
 * peor hora. El domingo entre las 9:00 y las 11:00, las 36 sedes registran
 * asistencia y entregan niños A LA MISMA HORA. Medir el promedio semanal y
 * concluir que aguanta es la forma más común de caerse el día del estreno.
 *
 * Qué mide: latencia p50, p95 y p99, y errores, bajo concurrencia.
 * Qué NO mide: el comportamiento de Cloud Run bajo arranque en frío ni la
 * latencia de red real. Eso se mide en staging, contra la infraestructura
 * de verdad, y queda escrito para que nadie confunda una cosa con la otra.
 *
 * Uso: node scripts/probar-carga.js [concurrencia] [segundos]
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:3000';
const USUARIO = process.env.PRUEBA_USUARIO || 'prueba.auth@casaroca.org';
const CLAVE = process.env.PRUEBA_CLAVE || 'una frase larga de prueba 2026';
const CONCURRENCIA = Number(process.argv[2] || 36);   // una por sede
const SEGUNDOS = Number(process.argv[3] || 20);

/* El reparto imita un domingo: la mayoría son lecturas de pantalla y
   búsquedas de personas; los reportes son pocos y pesados. */
const MEZCLA = [
  { peso: 40, nombre: 'panel de sesion',   ruta: '/api/v1/sesion/yo' },
  { peso: 25, nombre: 'buscar persona',    ruta: '/api/v1/personas?limite=20&q=mar' },
  { peso: 15, nombre: 'bandeja de nuevos', ruta: '/api/v1/nuevos/dashboard' },
  { peso: 10, nombre: 'sedes',             ruta: '/api/v1/organizacion/sedes' },
  { peso:  5, nombre: 'modulos',           ruta: '/api/v1/identidad/modulos' },
  { peso:  5, nombre: 'salud',             ruta: '/salud' },
];
const RULETA = MEZCLA.flatMap(m => Array(m.peso).fill(m));

function percentil(a, p) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

async function entrar() {
  const r = await fetch(`${BASE}/api/v1/auth/entrar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: USUARIO, clave: CLAVE }),
  });
  const c = await r.json().catch(() => ({}));
  if (!c.acceso) {
    console.error('⛔ No se pudo entrar para la prueba de carga.');
    console.error('   Si el usuario exige segundo factor, use una cuenta sin techo N3.');
    process.exit(1);
  }
  return c.acceso;
}

async function main() {
  console.log(`· entrando`);
  const token = await entrar();
  const cab = { Authorization: `Bearer ${token}` };

  console.log(`· ${CONCURRENCIA} sedes en paralelo durante ${SEGUNDOS}s contra ${BASE}\n`);
  const fin = Date.now() + SEGUNDOS * 1000;
  const medidas = new Map();
  let total = 0, errores = 0;

  async function trabajador() {
    while (Date.now() < fin) {
      const p = RULETA[Math.floor(Math.random() * RULETA.length)];
      const t = process.hrtime.bigint();
      try {
        const r = await fetch(BASE + p.ruta, { headers: cab });
        const ms = Number(process.hrtime.bigint() - t) / 1e6;
        if (!medidas.has(p.nombre)) medidas.set(p.nombre, []);
        medidas.get(p.nombre).push(ms);
        total++;
        if (r.status >= 400 && r.status !== 404) errores++;
      } catch { errores++; total++; }
    }
  }

  const t0 = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));
  const dur = (Date.now() - t0) / 1000;

  const todas = [...medidas.values()].flat();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CARGA DEL DOMINGO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(` peticiones: ${total} en ${dur.toFixed(1)}s · ${(total / dur).toFixed(0)}/s`);
  console.log(` errores:    ${errores} (${(100 * errores / Math.max(total, 1)).toFixed(2)} %)`);
  console.log('');
  console.log(' operacion              n      p50      p95      p99      max');
  console.log(' ─────────────────────────────────────────────────────────────');
  for (const [nombre, a] of [...medidas].sort()) {
    console.log(` ${nombre.padEnd(20)} ${String(a.length).padStart(5)} ` +
      `${percentil(a, .50).toFixed(0).padStart(7)}ms ${percentil(a, .95).toFixed(0).padStart(6)}ms ` +
      `${percentil(a, .99).toFixed(0).padStart(6)}ms ${Math.max(...a).toFixed(0).padStart(6)}ms`);
  }
  console.log(' ─────────────────────────────────────────────────────────────');
  console.log(` ${'TOTAL'.padEnd(20)} ${String(todas.length).padStart(5)} ` +
    `${percentil(todas, .50).toFixed(0).padStart(7)}ms ${percentil(todas, .95).toFixed(0).padStart(6)}ms ` +
    `${percentil(todas, .99).toFixed(0).padStart(6)}ms ${Math.max(...todas).toFixed(0).padStart(6)}ms`);
  console.log('');

  /* Los umbrales salen del SLA por módulo de docs/ARQUITECTURA.md. */
  const p95 = percentil(todas, .95), tasaError = errores / Math.max(total, 1);
  const problemas = [];
  if (p95 > 500) problemas.push(`p95 de ${p95.toFixed(0)}ms (tope 500ms)`);
  if (tasaError > 0.01) problemas.push(`${(tasaError * 100).toFixed(2)} % de errores (tope 1 %)`);

  if (problemas.length) {
    console.log('⛔ NO PASA: ' + problemas.join(' · '));
    process.exit(1);
  }
  console.log('✔ PASA: p95 por debajo de 500ms y menos de 1 % de errores.');
  console.log('⛔ Esto mide la aplicacion y la base, no la red ni el arranque en frio');
  console.log('   de Cloud Run. La medicion que vale para el SLA se repite en staging.');
}
main().catch(e => { console.error('⛔ ' + e); process.exit(1); });
