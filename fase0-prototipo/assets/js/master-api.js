/* ============================================================
   CASA ROCA · EL PUENTE CON LA API REAL

   Hasta hoy el Control Tower vivía en localStorage: cero llamadas al
   servidor. La base estaba bien construida y la aplicación no le
   hablaba. Esto los une.

   ⛔ EL PROBLEMA DE FONDO, Y CÓMO SE RESUELVE
   `MSTORE` es SÍNCRONO: `M.sedes()` devuelve un array, y las 30 vistas
   del master están escritas contra eso. La API es asíncrona. Convertir
   toda la interfaz a asíncrona sería reescribir 2.400 líneas y volver a
   introducir los fallos que se acaban de cerrar.

   Así que se HIDRATA: al arrancar, si la API responde, se trae el censo
   de verdad UNA vez y se deja en el mismo sitio del que el master ya
   bebe. Las lecturas siguen siendo instantáneas; las ESCRITURAS van al
   servidor y luego refrescan. Es una caché de lo que dice el servidor,
   no una segunda verdad.

   ⛔ Y SI NO HAY API, NO PASA NADA MALO. El sitio publicado en Netlify
   no tiene servidor detrás: allí sigue el juego sembrado, y la pantalla
   lo DICE. Un demo que finge estar conectado es peor que un demo.
   ============================================================ */
(function () {
  "use strict";

  /* De dónde sale la dirección de la API, en este orden:
     1. ?api=http://... en la URL, para probar sin tocar nada
     2. window.CASAROCA_API, si alguien la fija en el HTML
     3. localhost:3010 cuando se está sirviendo en local
     4. nada: modo demostración */
  function direccion() {
    try {
      const u = new URLSearchParams(location.search).get("api");
      if (u) return u.replace(/\/$/, "");
    } catch (e) {}
    if (window.CASAROCA_API) return String(window.CASAROCA_API).replace(/\/$/, "");
    if (/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) return "http://127.0.0.1:3010";
    return null;
  }

  const BASE = direccion();

  /* Quién dice el navegador que entró. En Fase 0 es la misma llave que
     usa el puente de permisos; en producción será el token de Keycloak
     y esta es la ÚNICA línea que cambia. */
  function quien() {
    try { return localStorage.getItem("casaroca_panel_persona") || ""; } catch (e) { return ""; }
  }

  /* ⛔ LAS FECHAS SE NORMALIZAN, Y ESTE FALLO COSTÓ ENCONTRARLO.
     PostgreSQL devuelve `vigente_desde` como marca de tiempo completa
     («2026-09-16T05:00:00.000Z») y el prototipo compara vigencias como
     TEXTO contra «AAAA-MM-DD». Comparadas como texto, la marca con hora
     sale MAYOR que la fecha de hoy, así que toda asignación parecía no
     haber empezado todavía: la cabecera decía «0 módulos» con la sesión
     perfectamente abierta y el rol correcto.
     Un permiso que dice cero cuando son veintidós no se lee como un dato
     raro: se lee como que el sistema de permisos está roto. */
  function soloFecha(v) {
    if (!v) return null;
    const t = String(v);
    return t.length >= 10 ? t.slice(0, 10) : t;
  }

  async function pedir(ruta, opciones) {
    if (!BASE) throw new Error("sin-api");
    const r = await fetch(BASE + "/api/v1" + ruta, Object.assign({
      headers: Object.assign({
        "X-Persona-Id": quien(),
        "Content-Type": "application/json",
      }, (opciones || {}).headers || {}),
    }, opciones || {}));
    if (!r.ok) {
      let detalle = ""; try { detalle = (await r.json()).message || ""; } catch (e) {}
      const err = new Error(detalle || ("La API contestó " + r.status));
      err.estado = r.status;
      throw err;
    }
    return r.status === 204 ? null : r.json();
  }

  window.CASAROCA_API_CLIENTE = {
    direccion: BASE,
    hayApi: !!BASE,

    /** ¿Contesta, y con qué identidad? Es lo primero que se pregunta. */
    async saludo() {
      if (!BASE) return null;
      try { return await pedir("/sesion/yo"); }
      catch (e) { return null; }
    },

    /**
     * Trae de la API lo que el master necesita, en la MISMA forma que
     * usa `MSTORE`. La traducción vive aquí y en ningún otro sitio: las
     * vistas no saben si el dato vino del servidor o de la semilla, y esa
     * es exactamente la idea.
     */
    async hidratar() {
      const [yo, sedes, ministerios, roles, modulos, personas] = await Promise.all([
        pedir("/sesion/yo"),
        pedir("/organizacion/sedes"),
        pedir("/organizacion/ministerios"),
        pedir("/identidad/roles"),
        pedir("/identidad/modulos"),
        pedir("/personas?limite=500"),
      ]);

      const asignaciones = [];
      for (const p of personas) {
        /* Una llamada por persona es aceptable con el censo de hoy y
           sería un disparate con 25.000. Cuando el volumen lo pida, la
           API expondrá las asignaciones en bloque; queda anotado aquí
           para que no se descubra en producción. */
        try {
          const a = await pedir("/identidad/personas/" + p.id + "/asignaciones");
          a.forEach(x => asignaciones.push({
            id: x.id, personaId: p.id, rol: x.rol,
            alcanceTipo: x.alcance_tipo, alcanceId: x.alcance_id,
            nivelMax: x.nivel_max,
            desde: soloFecha(x.vigente_desde), hasta: soloFecha(x.vigente_hasta),
            acta: x.acta_referencia, otorgadoPor: null,
          }));
        } catch (e) {}
      }

      return {
        origen: "api",
        yo,
        personas: personas.map(p => ({
          id: p.id,
          nombre: [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido]
            .filter(Boolean).join(" "),
          correo: p.email_principal || "",
          documento: p.numero_documento || "",
          codigo: null, creadoEn: null, sedeId: p.sede_id,
        })),
        sedes: sedes.map(s => ({
          id: s.id, codigo: s.codigo, nombre: s.nombre, tipo: s.tipo,
          pais: s.pais, ciudad: s.ciudad, plantilla: null,
        })),
        ministerios: ministerios.map(m => ({
          id: m.id, codigo: m.codigo, nombre: m.nombre,
          clase: m.clase, nivel: m.nivel_dato, sedeId: null,
        })),
        roles, modulos, asignaciones,
        equipos: [], grupos: [], modsede: [], vinculos: [], hechos: [], bitacora: [],
      };
    },

    /* ---- escrituras: van al servidor, no al navegador ---- */
    otorgar(personaId, roles) {
      return pedir("/identidad/personas/" + personaId + "/otorgar",
        { method: "POST", body: JSON.stringify({ roles }) });
    },
    crearIglesia(d) {
      return pedir("/organizacion/sedes", { method: "POST", body: JSON.stringify(d) });
    },
    crearCasilla(d) {
      return pedir("/identidad/atributos", { method: "POST", body: JSON.stringify(d) });
    },
    fijarMinisterio(sedeId, ministerioId, activo) {
      return pedir("/organizacion/sedes/" + sedeId + "/ministerios/" + ministerioId,
        { method: "PUT", body: JSON.stringify({ activo }) });
    },
    lineaTiempo(personaId) { return pedir("/personas/" + personaId + "/linea-tiempo"); },
    pagosSinDueno() { return pedir("/aportes/pagos-sin-dueno"); },
  };
})();
