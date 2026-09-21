import { api } from '../api.js';
import { cola, memoria, vigilarConexion, ColaLlenaError } from '../offline.js';
import { esc, vacio, unaVez, avisar, cargando } from '../ui.js';

/**
 * Check-in y entrega de RocaKids. El flujo del domingo.
 *
 * ⛔ LO QUE LA AUDITORÍA ENCONTRÓ EN LA VERSIÓN ANTERIOR, Y QUE ESTA
 *    VERSIÓN CIERRA:
 *
 *  · Mandaba NOMBRES en texto libre y la API pide identificadores. Eso es
 *    un 400, y la cola descartaba los 400: cada niño registrado sin
 *    conexión se perdía en el primer reintento, con el comprobante ya
 *    entregado al papá.
 *  · Las salas estaban CABLEADAS en el archivo y la petición a la API se
 *    ignoraba. Sin red, el desplegable quedaba vacío y no se podía
 *    registrar absolutamente nada: la pantalla que existe para ese momento
 *    se quedaba muerta.
 *  · El acudiente era un campo de texto. Un texto libre convierte la
 *    salvaguarda en una formalidad: ahora se elige de la lista de quienes
 *    están autorizados, y la base rechaza a cualquier otro.
 *
 * ⭐ CÓMO FUNCIONA SIN CONEXIÓN: al preparar el domingo se descarga el
 *    censo de la sala (nombres, edades e identificadores) y la lista de
 *    acudientes de cada niño, y se guarda en el equipo. Con eso la sala
 *    trabaja sin red. Lo que NO se guarda nunca es la condición médica ni
 *    el código: lo que se guarda en un equipo se pierde con el equipo.
 */
export async function pintarCheckin(c, sesion) {
  const quien = { personaId: sesion?.persona?.id, usuario: sesion?.persona?.correo };
  let salas = memoria.leer('salas') ?? [];
  let salaActual = null, roster = [], acudientes = [], menorElegido = null;

  c.innerHTML = `
    <h1>Niños</h1>
    <p class="etiqueta">check-in y entrega · funciona sin conexión</p>
    <div id="banda-cola" style="margin:1rem 0"></div>
    <div class="tarjeta" style="margin-bottom:1rem">
      <div style="display:flex;gap:.6rem;align-items:end;flex-wrap:wrap">
        <div class="campo" style="flex:1;min-width:200px;margin:0">
          <label for="sala">Sala</label>
          <select id="sala"><option value="">Elija una sala…</option></select>
        </div>
        <button class="boton boton--suave" id="b-preparar">Preparar el domingo</button>
      </div>
      <p class="ayuda" id="pista-memoria" style="margin-top:.5rem"></p>
    </div>
    <div id="sala-estado"></div>
    <div id="panel"></div>
    <div id="rechazados" style="margin-top:1.5rem"></div>`;

  const selSala = c.querySelector('#sala');
  const zonaCola = c.querySelector('#banda-cola');
  const zonaEstado = c.querySelector('#sala-estado');
  const panel = c.querySelector('#panel');
  const zonaRech = c.querySelector('#rechazados');
  const pista = c.querySelector('#pista-memoria');

  /* ── Salas: primero lo guardado (sincrónico, funciona sin red), después
     se refresca si hay servidor. Al revés era lo que dejaba la pantalla
     muerta cuando se caía el wifi. ───────────────────────────────── */
  function pintarSalas() {
    selSala.innerHTML = '<option value="">Elija una sala…</option>' +
      salas.map(s => `<option value="${esc(s.id)}">${esc(s.sede_codigo)} · ${esc(s.nombre)}</option>`).join('');
    const cuando = memoria.cuando('salas');
    pista.textContent = salas.length
      ? `${salas.length} salas${cuando ? ' · guardadas el ' + new Date(cuando).toLocaleString('es-CO') : ''}`
      : 'Todavía no hay salas guardadas en este equipo. Conéctese una vez y pulse «Preparar el domingo».';
  }
  pintarSalas();

  api.obtener('/api/v1/rocakids/salas')
    .then(r => { salas = r; memoria.guardar('salas', r); pintarSalas(); })
    .catch(e => { if (!salas.length) pista.textContent = `No se pudieron cargar las salas: ${e.message}`; });

  /* ── Preparar el domingo: deja el equipo listo para trabajar sin red ── */
  c.querySelector('#b-preparar').addEventListener('click', ev => unaVez(ev.target, async () => {
    try {
      const s = await api.obtener('/api/v1/rocakids/salas');
      salas = s; memoria.guardar('salas', s);
      let n = 0;
      for (const sala of s) {
        const r = await api.obtener(`/api/v1/rocakids/salas/${sala.id}/roster`);
        memoria.guardar('roster.' + sala.id, r);
        n += r.length;
        for (const m of r) {
          try {
            const a = await api.obtener(`/api/v1/rocakids/menores/${m.menor_id}/acudientes`);
            memoria.guardar('acu.' + m.menor_id, a);
          } catch { /* un menor sin acudiente registrado: se verá al intentar */ }
        }
      }
      pintarSalas();
      avisar(`Listo: ${s.length} salas y ${n} niños guardados en este equipo. Ya puede trabajar sin conexión.`, 'ok');
    } catch (e) { avisar(`No se pudo preparar: ${e.message}`, 'error'); }
  }));

  selSala.addEventListener('change', () => cargarSala(selSala.value));

  async function cargarSala(salaId) {
    menorElegido = null; acudientes = [];
    if (!salaId) { panel.innerHTML = ''; zonaEstado.innerHTML = ''; return; }
    salaActual = salas.find(s => s.id === salaId) ?? null;

    roster = memoria.leer('roster.' + salaId) ?? [];
    if (roster.length) pintarPanel(); else panel.innerHTML = cargando(2);

    try {
      const r = await api.obtener(`/api/v1/rocakids/salas/${salaId}/roster`);
      roster = r; memoria.guardar('roster.' + salaId, r);
      pintarPanel();
    } catch (e) {
      if (!roster.length) {
        panel.innerHTML = vacio('📵', 'No hay censo de esta sala en este equipo',
          'Conéctese una vez y pulse «Preparar el domingo» para poder trabajar sin red.');
      } else {
        avisar('Trabajando con el censo guardado en este equipo.', 'info');
      }
    }
    pintarEstadoSala();
  }

  function pintarEstadoSala() {
    if (!salaActual) { zonaEstado.innerHTML = ''; return; }
    const adultos = Number(salaActual.adultos ?? 0);
    zonaEstado.innerHTML = `
      <div class="aviso ${adultos >= 2 ? 'aviso--ok' : 'aviso--error'}" role="status">
        ${adultos >= 2
          ? `Sala con ${adultos} adultos. La regla de dos adultos se cumple.`
          : `⛔ Esta sala tiene ${adultos} adulto(s). <strong>La regla exige dos.</strong>
             Para recibir igual hay que escribir el motivo, y queda registrado.`}
        <button class="boton boton--suave" id="b-servir" style="margin-left:.6rem">Entrar a servir</button>
      </div>`;
    zonaEstado.querySelector('#b-servir')?.addEventListener('click', ev => unaVez(ev.target, async () => {
      try {
        await api.enviar(`/api/v1/rocakids/salas/${salaActual.id}/entrar-a-servir`, {});
        avisar('Queda registrado que usted está en esta sala.', 'ok');
        const s = await api.obtener('/api/v1/rocakids/salas');
        salas = s; memoria.guardar('salas', s);
        salaActual = s.find(x => x.id === salaActual.id); pintarEstadoSala();
      } catch (e) { avisar(e.message, 'error'); }
    }));
  }

  function pintarPanel() {
    const dentro = roster.filter(m => m.esta_dentro);
    panel.innerHTML = `
      <div class="tarjeta">
        <h2 style="margin-bottom:.6rem">Recibir un niño</h2>
        <div class="campo">
          <label for="buscar-menor">Busque al niño o niña</label>
          <input id="buscar-menor" type="search" autocomplete="off" placeholder="Escriba parte del nombre">
        </div>
        <div id="lista-menores"></div>
        <div id="forma-recibir"></div>
      </div>

      <div class="tarjeta" style="margin-top:1rem">
        <h2 style="margin-bottom:.6rem">Entregar (${dentro.length} dentro)</h2>
        ${dentro.length
          ? `<div class="tabla" style="display:block">${dentro.map(m => `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;
                          padding:.5rem 0;border-bottom:1px solid var(--cr-borde)">
                <span>${esc(m.menor)} <span class="etiqueta">${m.edad} años</span></span>
                <button class="boton boton--suave" data-entregar="${esc(m.menor_id)}">Entregar</button>
              </div>`).join('')}</div>`
          : `<p style="color:var(--cr-texto-suave)">Todavía no hay ningún niño dentro de esta sala.</p>`}
      </div>`;

    const entrada = panel.querySelector('#buscar-menor');
    const lista = panel.querySelector('#lista-menores');
    const forma = panel.querySelector('#forma-recibir');

    function pintarLista(q) {
      const t = (q ?? '').trim().toLowerCase();
      const r = t.length < 2 ? [] : roster.filter(m => m.menor.toLowerCase().includes(t) && !m.esta_dentro).slice(0, 8);
      lista.innerHTML = !t || t.length < 2
        ? `<p class="ayuda">Escriba dos letras o más.</p>`
        : r.length
          ? r.map(m => `<button class="boton boton--suave boton--ancho" data-menor="${esc(m.menor_id)}"
                          style="justify-content:space-between;margin-bottom:.35rem">
                          <span>${esc(m.menor)}</span><span class="etiqueta">${m.edad} años</span></button>`).join('')
          : `<p class="ayuda">Nadie coincide en el censo de esta sala. ¿Está en la sala correcta?</p>`;
      lista.querySelectorAll('[data-menor]').forEach(b =>
        b.addEventListener('click', () => elegirMenor(b.dataset.menor)));
    }
    entrada.addEventListener('input', () => pintarLista(entrada.value));
    pintarLista('');

    async function elegirMenor(menorId) {
      menorElegido = roster.find(m => m.menor_id === menorId);
      acudientes = memoria.leer('acu.' + menorId) ?? [];
      forma.innerHTML = cargando(1);
      try {
        const a = await api.obtener(`/api/v1/rocakids/menores/${menorId}/acudientes`);
        acudientes = a; memoria.guardar('acu.' + menorId, a);
      } catch (e) {
        if (!acudientes.length) {
          forma.innerHTML = `<div class="aviso aviso--error" role="alert">
            No hay acudientes de ${esc(menorElegido.menor)} en este equipo y no hay conexión.
            ⛔ Un menor no se recibe sin acudiente autorizado.</div>`;
          return;
        }
      }
      pintarFormaRecibir();
    }

    function pintarFormaRecibir() {
      const pocosAdultos = Number(salaActual?.adultos ?? 0) < 2;
      forma.innerHTML = `
        <div style="border-top:1px solid var(--cr-borde);margin-top:.8rem;padding-top:.8rem">
          <p><strong>${esc(menorElegido.menor)}</strong> <span class="etiqueta">${menorElegido.edad} años</span>
             ${menorElegido.tiene_condiciones ? '<span class="distintivo distintivo--n4">tiene condición médica registrada</span>' : ''}</p>
          <div class="campo">
            <label for="acudiente">Quién lo entrega</label>
            <select id="acudiente" required>
              <option value="">Elija…</option>
              ${acudientes.map(a => `<option value="${esc(a.acudiente_id)}">${esc(a.acudiente)} · ${esc(a.parentesco)}</option>`).join('')}
            </select>
            <span class="ayuda">Solo quien está registrado como acudiente. La base rechaza a cualquier otro.</span>
          </div>
          ${pocosAdultos ? `
            <div class="campo">
              <label for="motivo">Motivo para recibir con menos de dos adultos</label>
              <input id="motivo" placeholder="Ej: el segundo maestro llega a las 9:30">
              <span class="ayuda">⛔ Queda registrado con su nombre.</span>
            </div>` : ''}
          <button class="boton boton--ancho" id="b-recibir">Registrar entrada</button>
        </div>`;
      forma.querySelector('#b-recibir').addEventListener('click', ev => unaVez(ev.target, () => recibir(forma)));
    }

    panel.querySelectorAll('[data-entregar]').forEach(b =>
      b.addEventListener('click', () => pedirEntrega(b.dataset.entregar)));
  }

  async function recibir(forma) {
    const acudienteId = forma.querySelector('#acudiente')?.value;
    const motivo = forma.querySelector('#motivo')?.value?.trim() ?? null;
    if (!acudienteId) { avisar('Elija quién entrega al niño.', 'error'); return; }
    if (Number(salaActual?.adultos ?? 0) < 2 && (!motivo || motivo.length < 10)) {
      avisar('Escriba el motivo para recibir con menos de dos adultos (al menos 10 caracteres).', 'error');
      return;
    }

    const datos = {
      menorId: menorElegido.menor_id,
      salaId: salaActual.id,
      entregadoPor: acudienteId,
      anulacionDosAdultos: motivo || undefined,
    };

    /* ⛔ Primero se ENCOLA (y si no se puede guardar, se falla y NO se
       entrega comprobante), después se intenta enviar. */
    let op;
    try {
      op = cola.encolar({ ruta: '/api/v1/rocakids/checkin', datos, menor: menorElegido.menor }, quien);
    } catch (e) {
      if (e instanceof ColaLlenaError) {
        avisar(e.message, 'error');
        forma.innerHTML = `<div class="aviso aviso--error" role="alert">${esc(e.message)}</div>`;
        return;
      }
      throw e;
    }

    /* El código de verdad lo devuelve el servidor y solo una vez. Si el
       envío no salió todavía, se dice claro en vez de inventar un número.
       ⛔ 20 sep 2026: se leía `op.codigo`, que NUNCA existe (la operación
          encolada no lo lleva; lo trae la RESPUESTA del servidor). El
          comprobante no se pintaba jamás y el niño no se podía retirar. */
    const r = navigator.onLine ? await vaciar() : null;
    const codigo = r?.respuestas?.[op.id]?.codigo ?? null;
    const enviado = !cola.pendientes() || !leerPendiente(op.id);
    forma.innerHTML = enviado && codigo
      ? comprobante(menorElegido.menor, codigo, salaActual.nombre)
      : `<div class="aviso aviso--info" role="status">
           <strong>${esc(menorElegido.menor)} quedó registrado en este equipo.</strong>
           El código de entrega se genera en el servidor: aparecerá aquí en cuanto vuelva la conexión.
           Mientras tanto, anote al niño en la planilla de la sala.
         </div>`;
    /* ⛔ El comprobante se guarda ANTES de repintar la sala: `cargarSala`
       reescribe el panel entero y se llevaba por delante el nodo donde
       acababa de pintarse el código. */
    const comprobanteHtml = forma.innerHTML;
    menorElegido = null;
    await cargarSala(salaActual.id);
    const forma2 = panel.querySelector('#forma-recibir');
    if (comprobanteHtml && forma2) forma2.innerHTML = comprobanteHtml;
  }

  function leerPendiente(id) { return cola.pendientes() && JSON.parse(localStorage.getItem('cr.cola') ?? '[]').some(x => x.id === id); }

  const comprobante = (menor, codigo, sala) => `
    <div class="tarjeta" style="text-align:center;border-color:var(--cr-mostaza-500);margin-top:.8rem">
      <p class="etiqueta">comprobante de entrega</p>
      <p style="font-family:var(--cr-fuente-display);font-size:1.4rem;margin:.3rem 0">${esc(menor)}</p>
      <p style="font-family:var(--cr-fuente-mono);font-size:2.4rem;letter-spacing:.2em;margin:.4rem 0">${esc(codigo)}</p>
      <p style="color:var(--cr-texto-suave);font-size:var(--cr-tx-sm);margin:0">Sala ${esc(sala)}</p>
      <p class="etiqueta" style="margin-top:.6rem">solo con este código se entrega al niño</p>
    </div>`;

  async function pedirEntrega(menorId) {
    const m = roster.find(x => x.menor_id === menorId);
    const puede = (memoria.leer('acu.' + menorId) ?? []).filter(a => a.autoriza_retiro);
    const codigo = prompt(`Código de entrega de ${m.menor}:`);
    if (!codigo) return;
    const quienRetira = puede.length === 1 ? puede[0].acudiente_id
      : prompt(`¿Quién lo retira?\n${puede.map((a, i) => `${i + 1}. ${a.acudiente} (${a.parentesco})`).join('\n')}\n\nEscriba el número:`);
    const elegido = puede.length === 1 ? quienRetira : puede[Number(quienRetira) - 1]?.acudiente_id;
    if (!elegido) { avisar('No se eligió a nadie autorizado para retirar.', 'error'); return; }

    try {
      const r = await api.enviar('/api/v1/rocakids/entregar', {
        checkinId: m.checkin_id, retiradoPor: elegido, codigo,
      });
      avisar(r.mensaje ?? 'Menor entregado.', 'ok');
      await cargarSala(salaActual.id);
    } catch (e) {
      avisar(e.message, 'error');   // «no autorizado» o «código incorrecto»: la base ya lo registró
    }
  }

  async function vaciar() {
    const r = await cola.vaciar(op => api.enviar(op.ruta, { ...op.datos, idempotencia: op.id }), quien);
    if (r.enviados) avisar(`${r.enviados} registro(s) enviados.`, 'ok');
    pintarCola(navigator.onLine);
    /* ⛔ Sin este `return`, quien llama no ve las respuestas del servidor
       y el CÓDIGO DE ENTREGA del niño se pierde igual que antes. */
    return r;
  }

  function pintarCola(enLinea) {
    const n = cola.pendientes();
    const rech = cola.rechazados();
    zonaCola.innerHTML = !enLinea
      ? `<div class="aviso aviso--error" role="status">Sin conexión. <strong>Siga registrando:</strong>
           lo que anote se guarda en este equipo y se envía solo al volver la red.
           ${n ? `Hay ${n} registro(s) esperando.` : ''}</div>`
      : n ? `<div class="aviso aviso--info" role="status">${n} registro(s) esperando envío.
              <button class="boton boton--suave" id="b-vaciar" style="margin-left:.5rem">Enviar ahora</button></div>`
          : rech.length ? '' : `<div class="aviso aviso--ok" role="status">Conectado. Todo enviado.</div>`;
    zonaCola.querySelector('#b-vaciar')?.addEventListener('click', ev => unaVez(ev.target, vaciar));

    /* ⛔ Lo rechazado se queda FIJO en pantalla, con nombre y motivo, hasta
       que alguien lo atienda. Antes era un aviso que se borraba a los seis
       segundos y sin nombrar al niño. */
    zonaRech.innerHTML = !rech.length ? '' : `
      <div class="tarjeta" style="border-color:var(--cr-peligro)">
        <h2 style="color:var(--cr-peligro);margin-bottom:.4rem">${rech.length} registro(s) que el servidor rechazó</h2>
        <p style="color:var(--cr-texto-suave);font-size:var(--cr-tx-sm)">
          ⛔ Estos niños NO quedaron registrados. Revise y corrija antes de terminar el turno.</p>
        ${rech.map(x => `
          <div style="border-top:1px solid var(--cr-borde);padding:.6rem 0">
            <strong>${esc(x.op.menor ?? 'registro')}</strong>
            <p style="margin:.2rem 0;font-size:var(--cr-tx-sm)">${esc(x.motivo)}</p>
            <button class="boton boton--suave" data-reintentar="${esc(x.op.id)}">Reintentar</button>
            <button class="boton boton--suave" data-olvidar="${esc(x.op.id)}">Ya lo resolví</button>
          </div>`).join('')}
      </div>`;
    zonaRech.querySelectorAll('[data-reintentar]').forEach(b => b.addEventListener('click', () => {
      cola.reintentarRechazado(b.dataset.reintentar); vaciar();
    }));
    zonaRech.querySelectorAll('[data-olvidar]').forEach(b => b.addEventListener('click', () => {
      cola.olvidarRechazado(b.dataset.olvidar); pintarCola(navigator.onLine);
    }));
  }

  vigilarConexion(enLinea => { pintarCola(enLinea); if (enLinea && cola.pendientes()) vaciar(); });
  window.addEventListener('cr:cola-cambio', () => pintarCola(navigator.onLine));
  pintarCola(navigator.onLine);
}
