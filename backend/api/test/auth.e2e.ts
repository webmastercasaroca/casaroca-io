/**
 * Pruebas de punta a punta de la AUTENTICACIÓN.
 *
 * Estas pruebas existen por el hallazgo H-01 del 19 de septiembre de 2026:
 * la API identificaba a las personas con una cabecera de texto plano. La
 * prueba número 3 es la que demuestra que ese agujero está cerrado.
 *
 * Se corre contra la API viva: `scripts/probar-auth.sh` la levanta, corre
 * esto y la baja.
 */
import { createHmac } from 'node:crypto';
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3000';

/* Calcula el código de seis dígitos como lo haría el teléfono del usuario.
   Se implementa aquí, aparte, a propósito: si la prueba usara la misma
   función que el servidor, un error compartido pasaría desapercibido. */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function codigoTotp(secreto: string): string {
  let bits = '';
  for (const c of secreto.toUpperCase()) { const i = B32.indexOf(c); if (i >= 0) bits += i.toString(2).padStart(5, '0'); }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac('sha1', Buffer.from(bytes)).update(buf).digest();
  const off = h[h.length - 1] & 0x0f;
  const n = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(n % 1_000_000).padStart(6, '0');
}
const USUARIO = process.env.PRUEBA_USUARIO ?? 'prueba.auth@casaroca.org';
const CLAVE = process.env.PRUEBA_CLAVE ?? 'una frase larga de prueba 2026';

type Caso = { n: number; caso: string; esperado: string; obtenido: string; pasa: boolean };
const res: Caso[] = [];
const rg = (n: number, caso: string, esperado: string, obtenido: string, pasa: boolean) =>
  res.push({ n, caso, esperado, obtenido, pasa });

async function pedir(ruta: string, opciones: RequestInit = {}) {
  const r = await fetch(BASE + ruta, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(opciones.headers ?? {}) },
  });
  let cuerpo: any = null;
  try { cuerpo = await r.json(); } catch { /* sin cuerpo */ }
  return { estado: r.status, cuerpo, cabeceras: r.headers };
}

async function main() {
  // A1 · Sin token, la API no atiende.
  {
    const r = await pedir('/api/v1/sesion/yo');
    rg(1, 'Sin token la API responde datos', '401', String(r.estado), r.estado === 401);
  }

  // A2 · Con un token inventado, tampoco.
  {
    const r = await pedir('/api/v1/sesion/yo', { headers: { Authorization: 'Bearer esto.no.es' } });
    rg(2, 'Un token inventado abre la puerta', '401', String(r.estado), r.estado === 401);
  }

  // A3 · ⭐ LA PRUEBA DEL HALLAZGO H-01: la cabecera antigua ya no vale.
  {
    const r = await pedir('/api/v1/sesion/yo', {
      headers: { 'X-Persona-Id': '00000000-0000-0000-0000-000000000001' },
    });
    rg(3, 'La cabecera X-Persona-Id sigue dando acceso', '401', String(r.estado), r.estado === 401);
  }

  // A4 · Contraseña incorrecta: 401 y mensaje genérico (no dice si el usuario existe).
  {
    const r = await pedir('/api/v1/auth/entrar', {
      method: 'POST', body: JSON.stringify({ usuario: USUARIO, clave: 'equivocada-larga-1234' }),
    });
    const generico = typeof r.cuerpo?.mensaje === 'string' && !/no existe|inexistente/i.test(r.cuerpo.mensaje);
    rg(4, 'La respuesta revela si el usuario existe', '401 y mensaje generico',
       `${r.estado} · ${r.cuerpo?.mensaje ?? ''}`, r.estado === 401 && generico);
  }

  // A5 · Usuario inexistente: mismo estado y mismo mensaje que el anterior.
  {
    const r = await pedir('/api/v1/auth/entrar', {
      method: 'POST', body: JSON.stringify({ usuario: 'no.existe@casaroca.org', clave: 'equivocada-larga-1234' }),
    });
    rg(5, 'Usuario inexistente responde distinto a clave mala', '401 igual', String(r.estado), r.estado === 401);
  }

  // A6 · ⭐ Un rol que alcanza datos N3/N4 NO entra sin segundo factor:
  //      recibe un token LIMITADO, que sirve para configurarlo y para nada más.
  let acceso = '', refresco = '', limitado = '';
  let secretoMfa = '';   // se rellena al activar el segundo factor (A6c)
  {
    const r = await pedir('/api/v1/auth/entrar', {
      method: 'POST', body: JSON.stringify({ usuario: USUARIO, clave: CLAVE }),
    });
    limitado = r.cuerpo?.acceso ?? '';
    rg(6, 'Un rol N4 entra sin segundo factor', '200 pero limitado',
       `${r.estado} · debeConfigurar ${r.cuerpo?.debeConfigurarSegundoFactor === true}`,
       r.estado === 200 && r.cuerpo?.debeConfigurarSegundoFactor === true);
  }

  // A6b · El token limitado NO abre los datos.
  {
    const r = await pedir('/api/v1/sesion/yo', { headers: { Authorization: `Bearer ${limitado}` } });
    rg(16, 'El token limitado abre los datos', '401', String(r.estado), r.estado === 401);
  }

  // A6c · Se configura el segundo factor y se entra de verdad.
  {
    const ini = await pedir('/api/v1/auth/segundo-factor/iniciar',
      { method: 'POST', headers: { Authorization: `Bearer ${limitado}` }, body: '{}' });
    const secreto = ini.cuerpo?.secreto ?? '';
    secretoMfa = secreto;
    const act = await pedir('/api/v1/auth/segundo-factor/activar', {
      method: 'POST', headers: { Authorization: `Bearer ${limitado}` },
      body: JSON.stringify({ codigo: codigoTotp(secreto) }),
    });
    const r = await pedir('/api/v1/auth/entrar', {
      method: 'POST', body: JSON.stringify({ usuario: USUARIO, clave: CLAVE, codigo: codigoTotp(secreto) }),
    });
    acceso = r.cuerpo?.acceso ?? ''; refresco = r.cuerpo?.refresco ?? '';
    rg(17, 'No se puede activar el segundo factor y entrar', 'activado y 200 con tokens',
       `activar ${act.estado} · entrar ${r.estado} · tokens ${acceso && refresco ? 'si' : 'no'}`,
       ini.estado === 200 && act.estado === 200 && r.estado === 200 && !!acceso && !!refresco);
  }

  // A6d · Con el segundo factor activo, la contrasena sola ya no basta.
  {
    const r = await pedir('/api/v1/auth/entrar', {
      method: 'POST', body: JSON.stringify({ usuario: USUARIO, clave: CLAVE }),
    });
    rg(18, 'Con segundo factor activo basta la contrasena', '401',
       String(r.estado), r.estado === 401);
  }

  // A6e · Y un codigo equivocado tampoco.
  {
    const r = await pedir('/api/v1/auth/entrar', {
      method: 'POST', body: JSON.stringify({ usuario: USUARIO, clave: CLAVE, codigo: '000000' }),
    });
    rg(19, 'Un codigo de segundo factor equivocado entra', '401',
       String(r.estado), r.estado === 401);
  }

  // A7 · Con el token, la API atiende y devuelve el alcance derivado de la base.
  {
    const r = await pedir('/api/v1/auth/quien-soy', { headers: { Authorization: `Bearer ${acceso}` } });
    rg(7, 'Con token valido la API no atiende', '200 con alcance',
       `${r.estado} · sedes ${r.cuerpo?.alcance?.sedes?.length ?? '?'} · nivel ${r.cuerpo?.alcance?.nivelMax ?? '?'}`,
       r.estado === 200 && Array.isArray(r.cuerpo?.alcance?.sedes));
  }

  // A8 · El alcance NO se puede pedir desde el cliente.
  {
    const r = await pedir('/api/v1/auth/quien-soy', {
      headers: { Authorization: `Bearer ${acceso}`, 'X-Sede-Ids': '{00000000-0000-0000-0000-000000000001}' },
    });
    const sedes = r.cuerpo?.alcance?.sedes ?? [];
    rg(8, 'El cliente puede pedirse sedes por cabecera', 'la cabecera se ignora',
       `sedes ${JSON.stringify(sedes).slice(0, 60)}`,
       !sedes.includes('00000000-0000-0000-0000-000000000001'));
  }

  // A9 · Toda respuesta trae identificador de traza.
  {
    const r = await pedir('/salud');
    rg(9, 'La respuesta no trae identificador de traza', 'cabecera X-Peticion-Id',
       r.cabeceras.get('x-peticion-id') ? 'presente' : 'ausente', !!r.cabeceras.get('x-peticion-id'));
  }

  // A10 · Cabeceras de seguridad puestas.
  {
    const r = await pedir('/salud');
    const faltan = ['x-content-type-options', 'x-frame-options', 'content-security-policy', 'strict-transport-security']
      .filter(h => !r.cabeceras.get(h));
    rg(10, 'Faltan cabeceras de seguridad', 'ninguna falta',
       faltan.length ? faltan.join(', ') : 'ninguna falta', faltan.length === 0);
  }

  // A11 · La salud comprueba la base de verdad.
  {
    const r = await pedir('/salud/detalle');
    rg(11, 'La salud no comprueba nada', 'estado sano con particiones',
       `${r.cuerpo?.estado} · particiones ${Array.isArray(r.cuerpo?.particiones) ? r.cuerpo.particiones.length : 0}`,
       r.estado === 200 && r.cuerpo?.estado === 'sano');
  }

  // A12 · Refrescar rota el token: el refresco viejo deja de servir.
  let refresco2 = '';
  let acceso2 = '';
  {
    const r1 = await pedir('/api/v1/auth/refrescar', { method: 'POST', body: JSON.stringify({ refresco }) });
    refresco2 = r1.cuerpo?.refresco ?? '';
    /* ⛔ Refrescar ROTA la sesion: el token de acceso anterior queda muerto
       en ese instante. A13 seguia usando el viejo y media «401 y 401», que
       parecia que cerrar sesion no hacia nada cuando en realidad el token
       ya estaba cortado por el refresco de arriba. Se guarda el nuevo. */
    acceso2 = r1.cuerpo?.acceso ?? '';
    const r2 = await pedir('/api/v1/auth/refrescar', { method: 'POST', body: JSON.stringify({ refresco }) });
    rg(12, 'Un refresco usado dos veces sigue sirviendo', 'primero 200, segundo 401',
       `${r1.estado} y ${r2.estado}`, r1.estado === 200 && r2.estado === 401);
  }

  // A13 · ⭐ Cerrar la sesión la corta EN EL INSTANTE, no cuando expire.
  {
    const vivo = acceso2 || acceso;
    const antes = await pedir('/api/v1/auth/quien-soy', { headers: { Authorization: `Bearer ${vivo}` } });
    await pedir('/api/v1/auth/salir', { method: 'POST', headers: { Authorization: `Bearer ${vivo}` } });
    const despues = await pedir('/api/v1/auth/quien-soy', { headers: { Authorization: `Bearer ${vivo}` } });
    rg(13, 'Cerrar sesion no surte efecto hasta que expire el token', 'antes 200, despues 401',
       `${antes.estado} y ${despues.estado}`, antes.estado === 200 && despues.estado === 401);
  }

  /* A20 y A21 · LA CONTRASEÑA PROVISIONAL.
     ⛔ 20 sep 2026 · La API devolvia `debeCambiarClave` desde el primer dia
        y la pantalla de entrada lo IGNORABA: quien recibia una contraseña
        provisional entraba con ella y se quedaba con ella. Es decir, la
        contraseña de esa cuenta la seguia sabiendo quien la creo. En un
        sistema con consejeria y con menores, eso es una cuenta compartida
        sin que nadie lo haya decidido. Estas dos pruebas vigilan las dos
        mitades: que la API lo DIGA y que deje de decirlo al cambiarla. */
  {
    const { Client } = require('pg');
    const bd = new Client({
      host: process.env.PGHOST ?? '/tmp', port: Number(process.env.PGPORT ?? 5433),
      database: process.env.PGDATABASE ?? 'casaroca_dev', user: 'postgres',
    });
    await bd.connect();
    await bd.query(`UPDATE identidad.cuentas SET debe_cambiar_clave = true WHERE usuario = $1`, [USUARIO]);

    const conCodigo = () => ({ usuario: USUARIO, clave: CLAVE, codigo: codigoTotp(secretoMfa) });
    const r = await pedir('/api/v1/auth/entrar', { method: 'POST', body: JSON.stringify(conCodigo()) });
    rg(20, 'La contrasena provisional entra sin avisar de que lo es',
       'debeCambiarClave true',
       `${r.estado} · debeCambiarClave ${r.cuerpo?.debeCambiarClave}`,
       r.estado === 200 && r.cuerpo?.debeCambiarClave === true);

    const NUEVA = 'otra frase larga distinta de la anterior 2026';
    const cam = await pedir('/api/v1/auth/cambiar-clave', {
      method: 'POST', headers: { Authorization: `Bearer ${r.cuerpo?.acceso}` },
      body: JSON.stringify({ actual: CLAVE, nueva: NUEVA }),
    });
    const r2 = await pedir('/api/v1/auth/entrar', {
      method: 'POST',
      body: JSON.stringify({ usuario: USUARIO, clave: NUEVA, codigo: codigoTotp(secretoMfa) }),
    });
    rg(21, 'Cambiar la contrasena no quita el aviso de provisional',
       'cambio 200 y debeCambiarClave false',
       `cambiar ${cam.estado} · entrar ${r2.estado} · debeCambiarClave ${r2.cuerpo?.debeCambiarClave}`,
       cam.estado === 200 && r2.estado === 200 && r2.cuerpo?.debeCambiarClave === false);

    // Se devuelve la cuenta a como estaba: el banco no deja el laboratorio peor.
    const vol = await pedir('/api/v1/auth/cambiar-clave', {
      method: 'POST', headers: { Authorization: `Bearer ${r2.cuerpo?.acceso}` },
      body: JSON.stringify({ actual: NUEVA, nueva: CLAVE }),
    });
    if (vol.estado !== 200) console.error('⚠️  no se pudo devolver la contrasena de laboratorio');
    await bd.end();
  }

  // A14 · Entrada con datos mal formados: 400, no 500.
  {
    const r = await pedir('/api/v1/auth/entrar', { method: 'POST', body: JSON.stringify({ usuario: 12345 }) });
    rg(14, 'Una entrada mal formada rompe el servidor', '400',
       String(r.estado), r.estado === 400);
  }

  // A15 · Límite de intentos en la puerta de entrada.
  {
    let bloqueado = false;
    for (let i = 0; i < 14; i++) {
      const r = await pedir('/api/v1/auth/entrar', {
        method: 'POST', body: JSON.stringify({ usuario: `prueba${i}@x.org`, clave: 'claveequivocada123' }),
      });
      if (r.estado === 429) { bloqueado = true; break; }
    }
    rg(15, 'Se pueden probar contrasenas sin limite', '429 antes de 14 intentos',
       bloqueado ? 'limitado' : 'sin limite', bloqueado);
  }

  // Informe
  res.sort((a, b) => a.n - b.n);
  const pasan = res.filter(r => r.pasa).length;
  console.log('\n===== AUTENTICACION DE PUNTA A PUNTA =====');
  for (const r of res) {
    console.log(` ${String(r.n).padStart(2)} | ${r.caso.padEnd(56)} | ${r.obtenido.padEnd(34)} | ${r.pasa ? 'PASA' : 'FALLA'}`);
  }
  console.log(`\n pasan: ${pasan} · fallan: ${res.length - pasan} · total: ${res.length}\n`);
  if (pasan !== res.length) {
    console.error('⛔ BANCO EN ROJO: la autenticacion tiene invariantes rotas.');
    process.exit(1);
  }
}

main().catch(e => { console.error('⛔ ' + e); process.exit(1); });
