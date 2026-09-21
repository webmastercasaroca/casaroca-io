/* ============================================================
   CASA ROCA · BRIDGE (Fase 0)
   Conecta el STORE en vivo (inscritos del landing → líder → director)
   con el CRM por rol de index.html (window.DB).

   Sin este puente, una persona que se inscribe en el landing aparece
   en la app del líder y del director (que leen window.STORE) pero NO
   en los paneles por rol (que solo leían window.DB estático).

   Qué hace:
   - Mapea cada inscrito del grupo "Café & Palabra" (af_j25_cafe) al
     formato de persona del CRM (DB.persona).
   - Expone DB.registrosVivos() para que las vistas lo concatenen.
   - Extiende DB.persona() para que el perfil 360° encuentre también a
     las personas inscritas en vivo (no solo las del seed estático).

   En Fase 1 (Supabase) este puente desaparece: todas las apps leerán de
   la misma base de datos y no hará falta unir capas.
   ============================================================ */
(function () {
  const DB = window.DB;
  const S = window.STORE;
  if (!DB || !S) return; // index.html debe cargar data.js, landing-data.js y store.js antes

  // Grupo demo canónico: Café & Palabra
  const AF_ID = "af_j25_cafe";   // id en el STORE / landing
  const GRUPO_DB = "g_j25_norte"; // mismo grupo en el CRM (window.DB.GRUPOS)
  const LIDER_ID = "p_daniel";    // Daniel Garzón

  function ini(n, a) {
    return (((n || "")[0] || "") + ((a || "")[0] || "")).toUpperCase() || "·";
  }

  // Formación del STORE (objeto {adn:"ok",...}) → formato del CRM:
  // cursos cortos como array {nombre,estado}, Institutos (IBLI/FACTER) como
  // 'instituto', y un hito por cada curso verificado para la línea de tiempo.
  const NOMBRE_CURSO = { adn: "ADN", bautizo: "Bautizo", madurez: "Madurez Espiritual", llaves: "Llaves del Poder" };
  const EST_CRM = { ok: "Completado", curso: "En curso" };
  function mapFormacion(cs) {
    cs = (cs && typeof cs === "object") ? cs : {};
    const cursos = [], hitos = [];
    ["adn", "bautizo", "madurez", "llaves"].forEach(k => {
      if (cs[k] === "ok" || cs[k] === "curso") {
        cursos.push({ nombre: NOMBRE_CURSO[k], estado: EST_CRM[cs[k]] });
        if (cs[k] === "ok") hitos.push({ tipo: "Curso " + NOMBRE_CURSO[k], fecha: "", color: "mostaza",
          txt: "Su líder verificó que completó <b>" + NOMBRE_CURSO[k] + "</b>." });
      }
    });
    let instituto = null;
    const progKey = cs.facter ? "facter" : (cs.ibli ? "ibli" : null);
    if (progKey) {
      instituto = { programa: progKey.toUpperCase(), semestre: 1, estado: cs[progKey] === "ok" ? "Completado" : "Activa" };
      if (cs[progKey] === "ok") hitos.push({ tipo: "Instituto " + progKey.toUpperCase(), fecha: "", color: "verde",
        txt: "Su líder verificó <b>" + progKey.toUpperCase() + "</b> en el Instituto." });
    }
    return { cursos, instituto, hitos };
  }

  // STORE.inscrito  →  persona con la forma que esperan las vistas del CRM
  function mapInscrito(ins) {
    const form = mapFormacion(ins.cursos);
    return {
      id: ins.id,
      nombres: ins.nombres || "",
      apellidos: ins.apellidos || "",
      iniciales: ini(ins.nombres, ins.apellidos),
      rol: "Nuevo en grupo",
      sede: "bogota",
      etapa: ins.etapa || "conoce",
      subestado: ins.contactado ? "Contactado por su líder" : "Recién inscrito · sin contactar",
      telefono: ins.telefono || "—",
      email: ins.correo || "—",                 // STORE usa 'correo'; el CRM usa 'email'
      edad: ins.edad || null,
      estadoCivil: ins.estadoCivil || "—",
      conyuge: null,
      ministerio: "J+25 · Café & Palabra",
      grupo: GRUPO_DB,
      fuente: ins.fuente || "Inscripción en línea",
      primeraVisita: ins.fechaInscripcion || null,
      responsable: LIDER_ID,
      riesgo: false,
      esNuevo: true,
      diezma: false, diezmoAnual: 0, diezmos: [],
      cursos: form.cursos, instituto: form.instituto, consejerias: [], ayudasMas: [],
      hitos: [
        { tipo: "Se inscribió en un grupo", fecha: ins.fechaInscripcion || "", color: "mostaza",
          txt: "Se inscribió a <b>J+25 · Café & Palabra</b> desde la página." +
               (ins.fuente ? " Llegó por: " + ins.fuente + "." : "") }
      ].concat(form.hitos),
      notas: [], peticiones: [],
      _vivo: true // marca: viene del STORE en vivo
    };
  }

  // Lista de inscritos vivos del grupo, en formato CRM
  DB.registrosVivos = function () {
    try { return S.inscritos(AF_ID).map(mapInscrito); }
    catch (e) { return []; }
  };

  // Extiende DB.persona para que el perfil 360° encuentre a los inscritos vivos
  const _persona = DB.persona;
  DB.persona = function (id) {
    const base = _persona ? _persona(id) : undefined;
    if (base) return base;
    return DB.registrosVivos().find(p => p.id === id);
  };
})();
