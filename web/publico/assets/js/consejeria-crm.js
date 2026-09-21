/* ============================================================
   CASA ROCA · CONSEJERÍA — PUENTE AL CRM GENERAL (window.CSCRM)
   El "mini-CRM" de consejería NO es una base aparte: lee y escribe
   sobre el MISMO directorio de personas de la iglesia (window.STORE,
   el que alimentan el landing y el líder). Aquí se unifican:
     · Personas de la iglesia (STORE) — con su recorrido 4C y cursos
       (ADN, Bautizo, Madurez, Llaves, IBLI, FACTER).
     · Personas que llegan por una consejería (CONSESTORE).
   Se de-duplican por correo (o nombre normalizado) para no crear
   registros repetidos. En Fase 1 esto apunta a la tabla `persona`
   real de Supabase manteniendo la misma interfaz.
   Privacidad: este puente NUNCA expone el diezmo.
   ============================================================ */
(function () {
  "use strict";
  const GRUPO_DEMO = "af_j25_cafe"; // grupo sembrado del CRM de la iglesia (J+25 · Café & Palabra)

  function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase(); }
  function keyDe(p) { return norm(p.correo || p.email) || norm((p.nombres || p.nombre || "") + " " + (p.apellidos || "")); }
  /* La CÉDULA es la LLAVE entre el CRM general y consejería. Para que el
     mismo individuo tenga SIEMPRE la misma cédula en cualquier app, se
     deriva del correo (o del nombre si no hay correo). En Fase 1 la
     reemplaza la columna real `persona.cedula` de Supabase. */
  function cedulaDe(p) {
    const semilla = (p && (p.correo || p.email)) || (p && (p.nombre || ((p.nombres || "") + (p.apellidos || "")))) || "";
    return window.CEDULA ? window.CEDULA(semilla) : "—";
  }
  const CURSO_LBL = { adn: "ADN", bautizo: "Bautizo", madurez: "Madurez Espiritual", llaves: "Llaves del Poder", ibli: "IBLI", facter: "FACTER" };
  const ETAPA_LBL = { conoce: "Conoce", conecta: "Conéctate", crece: "Crece", sirve: "Sirve" };

  /* ---- personas de la iglesia desde STORE ---- */
  function iglesia() {
    const out = [];
    if (!window.STORE || !window.STORE.inscritos) return out;
    [GRUPO_DEMO].forEach(gid => {
      let arr = []; try { arr = window.STORE.inscritos(gid) || []; } catch (e) { arr = []; }
      arr.forEach(p => out.push({
        id: p.id, key: keyDe(p), cedula: cedulaDe(p),
        nombre: `${p.nombres || ""} ${p.apellidos || ""}`.trim(),
        correo: p.correo || "", telefono: p.telefono || "", edad: p.edad || null,
        genero: p.genero || null, estadoCivil: p.estadoCivil || null,
        etapa: p.etapa || null, cursos: p.cursos || {}, fuente: p.fuente || "",
        sede: "Bogotá Chicó", grupo: "J+25 · Café & Palabra",
        enIglesia: true, grupoId: gid,
      }));
    });
    return out;
  }

  /* ---- directorio unificado (iglesia + consejería), de-duplicado ---- */
  function personas() {
    const S = window.CONSESTORE, map = {};
    iglesia().forEach(p => { map[p.key] = p; });
    if (S) S.consejerias().forEach(c => {
      const k = norm(c.correo) || norm(c.persona);
      if (!map[k]) map[k] = { id: c.id, key: k, cedula: cedulaDe(c), nombre: c.persona, correo: c.correo || "", telefono: c.tel || "", edad: c.edad || null, genero: c.genero || null, estadoCivil: null, etapa: null, cursos: {}, enIglesia: false, sede: "—", grupo: c.ministerio || "—" };
      const p = map[k];
      if (!p.telefono && c.tel) p.telefono = c.tel;
      if (!p.correo && c.correo) p.correo = c.correo;
      if (p.edad == null && c.edad != null) p.edad = c.edad;
      if (!p.genero && c.genero) p.genero = c.genero;
      (p.consejerias = p.consejerias || []).push(c);
    });
    return Object.keys(map).map(k => map[k]);
  }
  function buscar(q) {
    q = norm(q); const all = personas();
    if (!q) return all;
    return all.filter(p => norm(p.nombre + " " + p.correo + " " + p.telefono + " " + p.grupo).indexOf(q) >= 0);
  }
  function porKey(key) { return personas().find(p => p.key === key) || null; }

  /* consejerías de una persona (por correo/nombre) */
  function consejeriasDe(p) {
    const S = window.CONSESTORE; if (!S) return [];
    const k = p.key;
    return S.consejerias().filter(c => (norm(c.correo) || norm(c.persona)) === k);
  }

  /* ---- alimentar el CRM general sin duplicar ----
     Si la persona ya existe (por correo/nombre) devuelve la existente;
     si no, la agrega al directorio de la iglesia (STORE) y la devuelve. */
  function vincularONuevo(datos) {
    const k = norm(datos.correo) || norm(datos.nombre);
    const ya = porKey(k);
    if (ya && ya.enIglesia) return { creado: false, persona: ya };
    if (window.STORE && window.STORE.agregar) {
      const partes = String(datos.nombre || "").trim().split(/\s+/);
      const r = window.STORE.agregar(GRUPO_DEMO, {
        nombres: partes.slice(0, -1).join(" ") || partes[0] || datos.nombre, apellidos: partes.length > 1 ? partes.slice(-1).join(" ") : "",
        correo: datos.correo || "", telefono: datos.telefono || "", edad: datos.edad || null,
        genero: datos.genero || null, etapa: "conoce", cursos: {}, fuente: "Consejería",
      });
      if (r && r.ok) return { creado: true, persona: r.persona };
    }
    return { creado: false, persona: ya };
  }

  window.CSCRM = { personas, buscar, porKey, consejeriasDe, vincularONuevo, iglesia, cedulaDe, CURSO_LBL, ETAPA_LBL, norm, GRUPO_DEMO };
})();
