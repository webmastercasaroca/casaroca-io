/* ============================================================
   CASA ROCA · STORE compartido (Fase 0 — sin backend)
   Fuente de verdad común entre el LANDING (experiencia v2/v3) y la
   APP DEL LÍDER (lider.html). Persiste en localStorage para que lo
   que pasa en una pestaña (inscribirse / bloquear) se refleje en la
   otra en vivo.
   Cuando exista backend (Supabase, Fase 1) este módulo se reemplaza
   por llamadas reales manteniendo la misma interfaz pública.
   Se expone como window.STORE.
   ============================================================ */
window.STORE = (function () {
  const KEY = "casaroca_fase0_store_v1";

  // ¿Hay localStorage disponible? (en node/verificación no existe) ----
  const hasLS = (function () {
    try { return typeof localStorage !== "undefined" && localStorage !== null; }
    catch (e) { return false; }
  })();
  let mem = null; // respaldo en memoria si no hay localStorage

  /* ------------------------------------------------------------
     SEED — datos demo precargados.
     El grupo de Daniel Garzón = "Café & Palabra" (af_j25_cafe).
     Son personas que se inscribieron por el landing, cada una con
     todos sus datos para que el líder pueda acompañarlas.
     'cumpleMes'/'cumpleDia' permiten avisar cumpleaños sin exponer
     el año; 'edad' se guarda aparte. Fechas en ISO (YYYY-MM-DD).
     ------------------------------------------------------------ */
  const SEED = {
    v: 1,
    grupos: {
      af_j25_cafe: {
        cerrado: false,
        inscritos: [
          { id: "ins_seed_1", nombres: "Mariana", apellidos: "López", correo: "mariana.lopez@email.com",
            telefono: "+57 311 555 0142", edad: 27, etapa: "conoce", cumpleMes: 6, cumpleDia: 18,
            estadoCivil: "Soltera", fechaInscripcion: "2026-06-10", fuente: "Invitada por una amiga",
            contactado: false, origen: "landing",
            cursos: { adn: "curso" } },
          { id: "ins_seed_2", nombres: "Julián", apellidos: "Mejía", correo: "julian.mejia@email.com",
            telefono: "+57 320 555 8810", edad: 31, etapa: "conecta", cumpleMes: 6, cumpleDia: 15,
            estadoCivil: "Unión libre", fechaInscripcion: "2026-06-08", fuente: "QR en la sede",
            contactado: true, origen: "landing",
            cursos: { adn: "ok", bautizo: "ok", madurez: "curso" } },
          { id: "ins_seed_3", nombres: "Daniela", apellidos: "Fonseca", correo: "daniela.fonseca@email.com",
            telefono: "+57 315 555 2204", edad: 24, etapa: "conoce", cumpleMes: 11, cumpleDia: 2,
            estadoCivil: "Soltera", fechaInscripcion: "2026-06-12", fuente: "Redes sociales",
            contactado: false, origen: "landing",
            cursos: {} },
          { id: "ins_seed_4", nombres: "Andrés", apellidos: "Camacho", correo: "andres.camacho@email.com",
            telefono: "+57 300 555 7733", edad: 29, etapa: "crece", cumpleMes: 6, cumpleDia: 25,
            estadoCivil: "Casado", fechaInscripcion: "2026-05-30", fuente: "Invitado por su esposa",
            contactado: true, origen: "landing",
            cursos: { adn: "ok", bautizo: "ok", madurez: "ok", llaves: "curso", ibli: "ok" } },
          { id: "ins_seed_5", nombres: "Valentina", apellidos: "Ruiz", correo: "valentina.ruiz@email.com",
            telefono: "+57 312 555 6190", edad: 26, etapa: "conoce", cumpleMes: 9, cumpleDia: 14,
            estadoCivil: "Soltera", fechaInscripcion: "2026-06-13", fuente: "Vino sola un domingo",
            contactado: false, origen: "landing",
            cursos: {} },
          { id: "ins_seed_6", nombres: "Sebastián", apellidos: "Torres", correo: "sebastian.torres@email.com",
            telefono: "+57 318 555 3471", edad: 33, etapa: "conecta", cumpleMes: 2, cumpleDia: 20,
            estadoCivil: "Casado", fechaInscripcion: "2026-06-01", fuente: "Recomendado por su jefe",
            contactado: true, origen: "landing",
            cursos: { adn: "ok", bautizo: "curso" } },
          { id: "ins_seed_7", nombres: "Laura", apellidos: "Beltrán", correo: "laura.beltran@email.com",
            telefono: "+57 313 555 9028", edad: 22, etapa: "conoce", cumpleMes: 7, cumpleDia: 3,
            estadoCivil: "Soltera", fechaInscripcion: "2026-06-14", fuente: "Escaneó el QR en la U",
            contactado: false, origen: "landing",
            cursos: { adn: "curso" } }
        ]
      }
    },
    /* --------------------------------------------------------------
       CURSOS — Cada pastor crea/edita los cursos cortos de SU sede
       desde la pestaña "Cursos". El landing los muestra en "Crece"
       filtrados por ciudad (cada sede tiene fechas, horarios y
       modalidad distintos). Los Institutos (IBLI/FACTER) NO viven
       aquí: son corporativos/globales y se gestionan aparte.
       'sede' = id de ciudad del landing (bogota/medellin/cali/…).
       'inicia' en ISO (YYYY-MM-DD) o "" para "matrícula abierta".
       -------------------------------------------------------------- */
    cursos: [
      { id: "cur_bog_adn", sede: "bogota", nombre: "ADN", etapa: "conecta", ico: "🧬",
        desc: "Tus primeros pasos y la identidad de Casa Roca.", profesor: "Ps. Camilo Restrepo",
        modalidad: "Presencial", dia: "Domingos 9:00 am", sesiones: "4 sesiones",
        inicia: "2026-07-06", cupo: 30, inscritos: 24, activo: true },
      { id: "cur_bog_bautizo", sede: "bogota", nombre: "Bautizo", etapa: "conecta", ico: "💧",
        desc: "Preparación para dar el paso del bautismo en agua.", profesor: "Ps. Andrea Pineda",
        modalidad: "Presencial", dia: "Sábados 4:00 pm", sesiones: "2 sesiones",
        inicia: "2026-07-13", cupo: 40, inscritos: 18, activo: true },
      { id: "cur_bog_madurez", sede: "bogota", nombre: "Madurez Espiritual", etapa: "crece", ico: "🌳",
        desc: "Fundamentos para crecer firme en tu fe.", profesor: "Ps. Jorge Ariza",
        modalidad: "Híbrido", dia: "Miércoles 7:00 pm", sesiones: "8 sesiones",
        inicia: "2026-07-01", cupo: 35, inscritos: 31, activo: true },
      { id: "cur_bog_llaves", sede: "bogota", nombre: "Llaves del Poder", etapa: "crece", ico: "🔑",
        desc: "Vida en el Espíritu y dones para servir.", profesor: "Ps. Lina Caro",
        modalidad: "Presencial", dia: "Domingos 4:00 pm", sesiones: "6 sesiones",
        inicia: "2026-08-03", cupo: 30, inscritos: 12, activo: true },
      { id: "cur_med_adn", sede: "medellin", nombre: "ADN", etapa: "conecta", ico: "🧬",
        desc: "Tus primeros pasos y la identidad de Casa Roca.", profesor: "Ps. Felipe Acosta",
        modalidad: "Virtual", dia: "Martes 7:00 pm", sesiones: "4 sesiones",
        inicia: "2026-07-14", cupo: 25, inscritos: 9, activo: true },
      { id: "cur_med_madurez", sede: "medellin", nombre: "Madurez Espiritual", etapa: "crece", ico: "🌳",
        desc: "Fundamentos para crecer firme en tu fe.", profesor: "Ps. Natalia Cruz",
        modalidad: "Presencial", dia: "Jueves 6:30 pm", sesiones: "8 sesiones",
        inicia: "2026-07-09", cupo: 30, inscritos: 14, activo: true },
      { id: "cur_cali_adn", sede: "cali", nombre: "ADN", etapa: "conecta", ico: "🧬",
        desc: "Tus primeros pasos y la identidad de Casa Roca.", profesor: "Ps. Óscar Tovar",
        modalidad: "Presencial", dia: "Domingos 10:00 am", sesiones: "4 sesiones",
        inicia: "2026-07-20", cupo: 20, inscritos: 7, activo: true }
    ]
  };

  /* ------------------------------------------------------------ I/O */
  function leerRaw() {
    if (hasLS) { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
    return mem;
  }
  function escribirRaw(obj) {
    if (hasLS) { try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {} }
    else { mem = obj; }
  }
  // MODO ENTREGA (vacío total): si window.CASAROCA_ENTREGA está activo, el primer
  // arranque nace en 0 (sin datos demo). Lo que el usuario cree luego persiste normal.
  const ENTREGA = (typeof window !== "undefined" && window.CASAROCA_ENTREGA);
  function init() {
    let data = leerRaw();
    if (!data || !data.grupos) { data = ENTREGA ? { v: 1, grupos: {}, cursos: [], crmPersonas: [], gpAutoriz: {} } : JSON.parse(JSON.stringify(SEED)); escribirRaw(data); }
    // Migración suave: instalaciones previas (sin 'cursos') heredan el seed
    // de cursos sin perder los grupos/inscritos ya guardados. (En entrega, no.)
    if (!ENTREGA && !Array.isArray(data.cursos)) { data.cursos = JSON.parse(JSON.stringify(SEED.cursos)); escribirRaw(data); }
    if (!Array.isArray(data.cursos)) { data.cursos = []; }
    // CRM central (Punto 1): registro único al que escriben TODOS los formularios.
    if (!Array.isArray(data.crmPersonas)) { data.crmPersonas = []; escribirRaw(data); }
    return data;
  }
  let DATA = init();

  /* ------------------------------------------- suscripción / eventos */
  const subs = [];
  function onCambio(cb) { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; }
  function emitir() { subs.forEach(cb => { try { cb(); } catch (e) {} }); }
  function persist() { escribirRaw(DATA); emitir(); }

  // Sincronización entre pestañas: cuando otra pestaña escribe, recargamos.
  if (hasLS && typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("storage", e => {
      if (e.key === KEY) { DATA = leerRaw() || DATA; emitir(); }
    });
  }

  /* --------------------------------------------------- acceso grupos */
  function grupo(afId) {
    if (!DATA.grupos[afId]) DATA.grupos[afId] = { cerrado: false, inscritos: [] };
    return DATA.grupos[afId];
  }
  function inscritos(afId) { return grupo(afId).inscritos.slice(); }

  // Datos del grupo desde LANDING (cupo y miembros base "heredados")
  function afData(afId) {
    return (window.LANDING && window.LANDING.afinidad) ? window.LANDING.afinidad(afId) : null;
  }
  function baseMiembros(afId) { const a = afData(afId); return a ? (a.miembros || 0) : 0; }
  function cupo(afId) { const a = afData(afId); return a ? (a.cupo || 0) : 0; }

  // Conteo efectivo = miembros base (heredados) + inscritos por la plataforma
  function miembrosEfectivos(afId) { return baseMiembros(afId) + grupo(afId).inscritos.length; }
  function disponible(afId) { const c = cupo(afId); return c ? Math.max(0, c - miembrosEfectivos(afId)) : 999; }

  /* --------------------------------------------- estado abierto/cerrado */
  function cerrado(afId) { return !!grupo(afId).cerrado; }
  // "lleno" para el landing = bloqueado manualmente O sin cupo disponible
  function lleno(afId) { const c = cupo(afId); return cerrado(afId) || (c > 0 && miembrosEfectivos(afId) >= c); }
  function setCerrado(afId, val) { grupo(afId).cerrado = !!val; persist(); return cerrado(afId); }
  function toggleCerrado(afId) { return setCerrado(afId, !cerrado(afId)); }

  /* ------------------------------------------------ alta de inscritos */
  function agregar(afId, persona) {
    if (cerrado(afId)) return { ok: false, motivo: "cerrado" };
    if (lleno(afId)) return { ok: false, motivo: "lleno" };
    const g = grupo(afId);
    const p = Object.assign({
      id: "ins_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      fechaInscripcion: new Date().toISOString().slice(0, 10),
      etapa: "conoce",
      contactado: false,
      origen: "landing"
    }, persona || {});
    g.inscritos.push(p);
    persist();
    return { ok: true, persona: p };
  }

  function marcarContactado(afId, insId, val) {
    const g = grupo(afId);
    const p = g.inscritos.find(x => x.id === insId);
    if (p) { p.contactado = val === undefined ? true : !!val; persist(); }
    return !!p;
  }
  function eliminar(afId, insId) {
    const g = grupo(afId);
    const i = g.inscritos.findIndex(x => x.id === insId);
    if (i >= 0) { g.inscritos.splice(i, 1); persist(); return true; }
    return false;
  }
  /* Formación por persona: el líder verifica los cursos que completó.
     key ∈ adn|bautizo|madurez|llaves|ibli|facter · estado ∈ "ok"|"curso"|null.
     persist() emite a los suscriptores → el CRM (vía bridge) se actualiza en vivo. */
  function setCursoEstado(afId, insId, key, estado) {
    const g = grupo(afId);
    const p = g.inscritos.find(x => x.id === insId);
    if (!p) return false;
    if (!p.cursos || typeof p.cursos !== "object") p.cursos = {};
    if (estado === "ok" || estado === "curso") p.cursos[key] = estado;
    else delete p.cursos[key];
    persist();
    return true;
  }

  /* ============================================================ CURSOS
     Cada pastor gestiona los cursos cortos de SU sede; el landing los
     lee filtrados por ciudad. Misma interfaz se conservará en Fase 1.
     ============================================================ */
  function asegurarCursos() { if (!Array.isArray(DATA.cursos)) DATA.cursos = []; return DATA.cursos; }
  function cursos() { return asegurarCursos().slice(); }
  function cursosDe(sede) { return asegurarCursos().filter(c => !sede || sede === "all" || c.sede === sede); }
  function curso(id) { return asegurarCursos().find(c => c.id === id) || null; }
  function nuevoCursoId() { return "cur_" + Date.now() + "_" + Math.floor(Math.random() * 1000); }

  function addCurso(obj) {
    const c = Object.assign({
      id: nuevoCursoId(), sede: "bogota", nombre: "Curso", etapa: "crece", ico: "📘",
      desc: "", profesor: "", modalidad: "Presencial", dia: "", sesiones: "",
      inicia: "", cupo: 0, inscritos: 0, activo: true
    }, obj || {});
    asegurarCursos().push(c);
    persist();
    return c;
  }
  function updateCurso(id, patch) {
    const c = curso(id);
    if (!c) return null;
    Object.assign(c, patch || {});
    persist();
    return c;
  }
  function delCurso(id) {
    const arr = asegurarCursos();
    const i = arr.findIndex(c => c.id === id);
    if (i >= 0) { arr.splice(i, 1); persist(); return true; }
    return false;
  }
  function toggleCursoActivo(id) {
    const c = curso(id);
    if (!c) return null;
    c.activo = !c.activo; persist();
    return c.activo;
  }

  /* ====================================== GRUPOS PEQUEÑOS · AUTORIZACIÓN
     Cada pastor autoriza (publica/oculta) los grupos pequeños de SU sede;
     el landing (Conéctate) solo muestra los autorizados de la sede elegida.
     Guardamos solo las EXCEPCIONES en DATA.gpAutoriz[afId] = true|false; si
     no hay override, el valor por defecto viene de la afinidad ('aprobado').
     Misma interfaz se conservará en Fase 1 (Supabase + RLS por sede).
     ==================================================================== */
  function asegurarGP() { if (!DATA.gpAutoriz || typeof DATA.gpAutoriz !== "object") DATA.gpAutoriz = {}; return DATA.gpAutoriz; }
  // ¿Está autorizado este grupo para verse en el landing?
  function autorizado(afId) {
    const ov = asegurarGP();
    if (Object.prototype.hasOwnProperty.call(ov, afId)) return !!ov[afId];
    const a = afData(afId);
    return a ? a.aprobado !== false : true;
  }
  function setAutorizado(afId, val) { asegurarGP()[afId] = !!val; persist(); return autorizado(afId); }
  function toggleAutorizado(afId) { return setAutorizado(afId, !autorizado(afId)); }
  // Catálogo de grupos de una sede (todos, para la gestión del pastor).
  function gruposSedeTodos(sedeId) {
    return (window.LANDING && window.LANDING.afinidadesDeSede) ? window.LANDING.afinidadesDeSede(sedeId) : [];
  }
  // Grupos de una sede AUTORIZADOS (lo que ve el landing en Conéctate).
  function gruposSede(sedeId) { return gruposSedeTodos(sedeId).filter(a => autorizado(a.id)); }

  /* ============================================================ CRM CENTRAL
     (Punto 1) Registro central de personas. La REGLA del sistema: ningún
     módulo es un ente independiente — TODO formulario, sin importar la
     pestaña donde se recoja (inscripción a cursos, alta manual, landing,
     etc.), escribe aquí. Los CRM por rol leen este registro como fuente
     compartida además de sus rosters. Dedupe por correo. En Fase 1 se
     reemplaza por la tabla `personas` conservando esta misma interfaz.
     ============================================================ */
  function asegurarCRM() { if (!Array.isArray(DATA.crmPersonas)) DATA.crmPersonas = []; return DATA.crmPersonas; }
  function crmPersonas() { return asegurarCRM().map(p => Object.assign({}, p)); }
  function crmBuscarPorCorreo(correo) {
    const c = String(correo || "").trim().toLowerCase();
    if (!c) return null;
    return asegurarCRM().find(p => String(p.correo || "").trim().toLowerCase() === c) || null;
  }
  // Alta/actualización central. 'origen' = pestaña/formulario que la creó
  // (curso, alta-manual, landing…). Dedupe por correo: si ya existe, fusiona.
  function crmAgregar(persona, origen) {
    const arr = asegurarCRM();
    const correo = String((persona && persona.correo) || "").trim().toLowerCase();
    let p = correo ? arr.find(x => String(x.correo || "").trim().toLowerCase() === correo) : null;
    if (p) { Object.assign(p, persona); if (origen) p.origen = p.origen || origen; persist(); return { ok: true, persona: p, dedup: true }; }
    p = Object.assign({
      id: "crm_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      fechaInscripcion: new Date().toISOString().slice(0, 10),
      etapa: "conoce", contactado: false, cursos: {}, origen: origen || "formulario"
    }, persona || {});
    arr.push(p);
    persist();
    return { ok: true, persona: p, dedup: false };
  }
  function crmEliminar(id) {
    const arr = asegurarCRM();
    const i = arr.findIndex(p => p.id === id);
    if (i >= 0) { arr.splice(i, 1); persist(); return true; }
    return false;
  }

  /* ----------------------------------------------------------- utils */
  function resetDemo() { DATA = JSON.parse(JSON.stringify(SEED)); persist(); }
  function soloDigitos(tel) { return String(tel || "").replace(/\D/g, ""); }

  return {
    KEY,
    grupo, inscritos,
    baseMiembros, cupo, miembrosEfectivos, disponible,
    cerrado, lleno, setCerrado, toggleCerrado,
    agregar, marcarContactado, eliminar, setCursoEstado,
    cursos, cursosDe, curso, addCurso, updateCurso, delCurso, toggleCursoActivo,
    autorizado, setAutorizado, toggleAutorizado, gruposSede, gruposSedeTodos,
    crmPersonas, crmBuscarPorCorreo, crmAgregar, crmEliminar,
    onCambio, resetDemo, soloDigitos
  };
})();

/* ============================================================
   CÉDULA (ID nacional) — helper global compartido por TODOS los CRM.
   En Fase 0 (sin backend) la cédula se deriva de forma determinista
   del id/correo de cada persona, así el mismo individuo muestra
   SIEMPRE el mismo número en cualquier app (líder, pastor, central…).
   En Fase 1 (Supabase) este valor lo provee la columna real `cedula`
   de la tabla persona; basta con que el objeto traiga p.cedula y este
   helper lo formatea.
   Uso:  window.CEDULA(persona)            → "1.012.345.678"
         window.CEDULA(persona, {raw:true}) → "1012345678"
   Privacidad: la VISIBILIDAD de la cédula la decide cada vista según
   el rol (pastores y equipos administrativos sí; directores, líderes
   y coordinadores no). Este helper solo calcula/formatea el valor.
   ============================================================ */
window.CEDULA = (function () {
  function hashNum(str) {
    let h = 2166136261;
    str = String(str == null ? "x" : str);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  // 10 dígitos plausibles para cédula colombiana moderna (1.0xx.xxx.xxx).
  function generar(seed) { return String(1000000000 + (hashNum(seed) % 900000000)); }
  function fmt(num) { return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function raw(p) {
    if (p == null) return "";
    if (typeof p === "object") {
      if (p.cedula) return String(p.cedula).replace(/\D/g, "");
      return generar(p.id || p.correo || p.email || ((p.nombres || "") + (p.apellidos || "")) || JSON.stringify(p));
    }
    const s = String(p);
    return /^\d[\d.]*$/.test(s) ? s.replace(/\D/g, "") : generar(s);
  }
  function cedula(p, opts) {
    const r = raw(p);
    if (!r) return "—";
    return (opts && opts.raw) ? r : fmt(r);
  }
  cedula.gen = generar;
  cedula.raw = function (p) { return raw(p); };
  return cedula;
})();
