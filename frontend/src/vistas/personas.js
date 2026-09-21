import { api } from '../api.js';
import { esc, cargando, vacio, error, distintivoNivel, engancharReintentar } from '../ui.js';

/** Buscar personas. Un solo cuadro: nombre mal escrito, documento, teléfono
    o correo. La base tolera los errores de digitación; sin eso, quien busca
    «Jon» no encuentra a «Jhon» y crea el duplicado. */
export function pintarPersonas(c) {
  c.innerHTML = `
    <h1>Personas</h1>
    <form id="buscar" role="search" style="display:flex;gap:.5rem;margin-bottom:1rem">
      <label class="sr-solo" for="q">Buscar persona</label>
      <input id="q" name="q" type="search" placeholder="Nombre, documento, teléfono o correo"
             autocomplete="off" enterkeyhint="search">
      <button class="boton" type="submit">Buscar</button>
    </form>
    <div id="resultado">${vacio('🔎', 'Busque a alguien',
      'Escriba parte del nombre aunque no esté seguro de cómo se escribe, o el documento o el teléfono.')}</div>`;

  const salida = c.querySelector('#resultado');
  const entrada = c.querySelector('#q');
  entrada.focus();

  let ultimo = 0;
  async function buscar(q) {
    if (!q || q.trim().length < 2) {
      salida.innerHTML = vacio('🔎', 'Escriba un poco más', 'Con dos letras o más ya se puede buscar.');
      return;
    }
    const mio = ++ultimo;
    salida.innerHTML = cargando(3);
    try {
      const r = await api.obtener('/api/v1/personas?limite=25&q=' + encodeURIComponent(q.trim()));
      if (mio !== ultimo) return;               // llegó una respuesta vieja
      const filas = Array.isArray(r) ? r : (r?.datos ?? r?.filas ?? []);
      if (!filas.length) {
        salida.innerHTML = vacio('🫥', 'Nadie coincide',
          'Puede que la persona esté en otra sede, o que todavía no esté registrada.');
        return;
      }
      salida.innerHTML = `
        <p class="etiqueta">${filas.length} resultado(s) dentro de su alcance</p>
        <div class="tarjeta" style="padding:0;overflow:hidden;margin-top:.5rem">
          <table class="tabla">
            <thead><tr><th>Nombre</th><th>Documento</th><th>Sede</th><th>Estado</th></tr></thead>
            <tbody>${filas.map(p => `
              <tr>
                <td data-th="Nombre"><strong>${esc(p.nombre ?? [p.primer_nombre, p.primer_apellido].filter(Boolean).join(' '))}</strong></td>
                <td data-th="Documento"><code>${esc(p.documento ?? p.numero_documento ?? '—')}</code></td>
                <td data-th="Sede">${esc(p.sede_codigo ?? p.sede ?? '')}</td>
                <td data-th="Estado">${esc(p.estado ?? '')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) {
      if (mio !== ultimo) return;
      /* ⛔ El tercer argumento no existe en `error()`: se descartaba en
         silencio y el botón «Reintentar» se pintaba sin escuchador. Un
         botón visible que no hace nada es peor que no tenerlo. */
      salida.innerHTML = error(e.message, e.peticionId);
      engancharReintentar(salida, () => buscar(entrada.value));
    }
  }

  c.querySelector('#buscar').addEventListener('submit', ev => { ev.preventDefault(); buscar(entrada.value); });
  let temporizador;
  entrada.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => buscar(entrada.value), 350);
  });
}
