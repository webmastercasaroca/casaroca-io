/* ============================================================
   CASA ROCA · CONSEJERÍA — FORMULARIO PÚBLICO DE SOLICITUD
   Página de cara al miembro que pide una cita de apoyo espiritual.

   Flujo:
     1) Portada/disclaimer  →  el solicitante debe ACEPTAR para iniciar.
     2) Formulario completo (datos, espiritual, solicitud, evaluación,
        consentimientos).
     3) Al enviar → se construye una solicitud y se guarda con
        CONSESTORE.addConsejeria({ estado: "solicitada", consejero: null }).
        Eso la deposita EN VIVO en la "Bandeja de solicitudes" del
        Coordinador y/o Director de Consejería (su bucket), sin asignar.
     4) Pantalla de confirmación.

   Sin frameworks. Comparte estado con las apps de consejería vía
   window.CONSESTORE (consejeria-data.js). Mobile-first, accesible.
   ============================================================ */
(function () {
  "use strict";

  const root = document.getElementById("sol-app");
  const C = window.CONSE;
  const S = window.CONSESTORE;
  const U = window.CSUI || { esc: s => String(s == null ? "" : s), toast: () => {} };
  const esc = U.esc;

  /* ---------------- catálogos ---------------- */
  const RANGOS = [
    "8-10 años (menor de edad - iglesia infantil)",
    "11-17 años (menor de edad)",
    "18-20 años", "21-25 años", "26-30 años", "31-35 años", "36-40 años",
    "41-45 años", "46-50 años", "51-55 años", "56-60 años", "61 años o más",
  ];
  const ESTADO_CIVIL = ["Soltero (a)", "Casado (a)", "Unión Libre", "Separado (a)", "Viudo (a)"];
  const TIEMPO = [
    "No me congrego", "Me congrego en otro lugar", "Menos de 6 meses",
    "Entre 6 meses y 1 año", "Entre 1 y 5 años", "Entre 5 y 10 años", "Más de 10 años",
  ];
  const MINISTERIOS = [
    "Años Dorados", "Ejecutivos y Empresarios", "Hombres de Bien", "Casa2", "tMt",
    "Centuriones", "Josués", "Mujer Integral", "J25", "Ninguno",
  ];
  const VOLUNTARIADO = [
    "Años Dorados", "Ejecutivos y Empresarios", "Hombres de Bien", "Casa2", "tMt",
    "Centuriones", "Josués", "Alabanza", "A.M.E.C.", "M.A.S", "Mujer Integral",
    "Nicodemo", "Oración", "Roca Kids", "Ujieres", "V.I.S.A.", "Equipo Creativo",
    "J25", "No soy voluntario",
  ];
  const PROCESOS = ["ADN", "Bautizo", "Llaves del Poder", "Madurez Espiritual", "IBLI", "Facter", "No he hecho ninguno"];
  const CARACTER = [
    "Individual",
    "Matrimonial (deseo ser atendido con mi pareja, y el o ella está de acuerdo)",
    "Familiar (deseo ser atendido con mi grupo familiar, y ellos están de acuerdo)",
    "Soy menor de edad",
    "Noviazgo",
  ];
  const TEMAS = [
    "Decisiones", "Conflicto Relacional (Pareja)", "Conflicto Relacional (Familiar)",
    "Sanidad - Perdón", "Inseguridad - Autoestima", "Identidad", "Dudas de Fé",
    "Duelo", "Violencia", "Adicciones", "Financiero", "Salud Mental", "Inmoralidad sexual",
  ];
  const QUIEN = ["Hombre", "Mujer", "Ambos"];
  const ESCALA = ["Casi nunca", "Algunas veces", "Mayoría de las veces", "Siempre"];
  const EVAL = [
    { id: "ev1", t: "Mantengo una sensación continua de incomodidad extrema (dolor de cabeza, depresión, ansiedad, úlcera aguda)." },
    { id: "ev2", t: "Siento que no hay esperanza, nada funciona, es abrumador lo que me está sucediendo y me ha llevado a hacer cosas como meterme en peleas, beber, hacer cosas arriesgadas, dormir todo el tiempo, dejar de trabajar/estudiar." },
    { id: "ev3", t: "No siento que pueda lidiar con esta situación y quiero irme/escapar, no me siento seguro de mis pensamientos, requiero de ayuda en cualquier decisión, me desconozco." },
    { id: "ev4", t: "Aunque mi rutina diaria no ha cambiado, siento que respondo a un 50-60% de mi capacidad normal." },
  ];
  const MODALIDAD = [
    "Presencial de Lunes a Viernes (8:00 am - 3:00 pm) — Instalaciones de la iglesia",
    "Virtual de Lunes a Viernes (8:00 am - 5:00 pm) — Video llamada",
  ];
  const CIUDADES = [
    "Bogotá - Chicó (sede madre)", "Bogotá - Norte", "Bogotá - Sur", "Bogotá - Occidente",
    "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Pereira",
    "Manizales", "Ibagué", "Villavicencio", "Cúcuta", "Santa Marta", "Neiva",
    "Pasto", "Armenia", "Montería", "Valledupar", "Miami (USA)", "Madrid (España)",
  ];

  /* enlaces oficiales de consentimiento informado (Google Drive) */
  const CONSENT = {
    adulto: "https://drive.google.com/file/d/17zl-UA4xjw1vCe0hr6n7E9yHT_pn1IH5/view?usp=share_link",
    adultoVirtual: "https://drive.google.com/file/d/1EVo1SWILeM5eNn7V5v5ZINulDVRqsB_f/view?usp=share_link",
    menor: "https://drive.google.com/file/d/1zX7s07ePTGc-uxpizORkbn4aetHZX1Q7/view?usp=share_link",
    menorVirtual: "https://drive.google.com/file/d/1gGwSASL-9fJO25T9wxzckLD3FCVMZkSv/view?usp=share_link",
  };

  /* mapeo del TEMA elegido → tipo de consejería del sistema (TIPOS) */
  const TEMA_TIPO = {
    "Decisiones": "vocacional",
    "Conflicto Relacional (Pareja)": "pareja",
    "Conflicto Relacional (Familiar)": "familiar",
    "Sanidad - Perdón": "espiritual",
    "Inseguridad - Autoestima": "emocional",
    "Identidad": "emocional",
    "Dudas de Fé": "espiritual",
    "Duelo": "duelo",
    "Violencia": "familiar",
    "Adicciones": "adicciones",
    "Financiero": "vocacional",
    "Salud Mental": "emocional",
    "Inmoralidad sexual": "espiritual",
  };
  /* temas que por sí solos elevan la prioridad mínima a media */
  const TEMAS_SENSIBLES = ["Violencia", "Adicciones", "Salud Mental", "Inmoralidad sexual"];

  /* ---------------- helpers de render ---------------- */
  function optList(name, items, type) {
    return `<div class="sol-opts" role="${type === "radio" ? "radiogroup" : "group"}">` +
      items.map((it, i) => {
        const val = typeof it === "string" ? it : it.val;
        const lbl = typeof it === "string" ? it : it.lbl;
        const id = name + "_" + i;
        return `<label class="sol-opt" for="${id}">
          <input type="${type}" id="${id}" name="${name}" value="${esc(val)}">
          <span>${esc(lbl)}</span></label>`;
      }).join("") + `</div>`;
  }
  function q(id, label, body, opts) {
    opts = opts || {};
    return `<div class="sol-q" data-q="${id}" ${opts.req ? 'data-req="1"' : ""} ${opts.type ? `data-type="${opts.type}"` : ""}>
      <label class="sol-q__label">${label}${opts.req ? ' <span class="req" aria-hidden="true">*</span>' : ""}</label>
      ${opts.help ? `<p class="sol-q__help ${opts.helpStrong ? "sol-q__help--strong" : ""}">${opts.help}</p>` : ""}
      ${body}
      <p class="sol-err" id="err_${id}">${opts.errMsg || "Esta pregunta es obligatoria."}</p>
    </div>`;
  }

  /* ============================================================
     PASO 1 — PORTADA / DISCLAIMER (debe aceptar para iniciar)
     ============================================================ */
  function renderGate() {
    root.innerHTML = `
      <header class="sol-hero">
        <div class="sol-hero__logo">CS</div>
        <h1>Servicio de Consejería · Casa Sobre la Roca</h1>
        <p>Apoyo, orientación y consejo espiritual con enfoque Cristo-céntrico.</p>
      </header>

      <section class="sol-card sol-card--banner">
        <p class="sol-section-title">Por favor leer antes de iniciar</p>
        <div class="sol-prose">
          <p>Te damos la bienvenida al servicio de consejería de <b>Casa Sobre la Roca, Iglesia Cristiana Integral</b>. Principalmente atendemos a los miembros activos de nuestra comunidad, es decir, que se congreguen en nuestra iglesia.</p>
          <p>Eres muy importante para Dios y también para nuestra iglesia. Estás recibiendo este mensaje porque te conectaste con la iglesia y vas a solicitar asistencia espiritual. Ofrecemos apoyo, orientación y consejo desde una perspectiva bíblica y con enfoque Cristo-céntrico, el cual se realiza a través de cristianos entrenados, <b>mas no profesionales</b> en el campo de la psicología, la psiquiatría o la salud mental.</p>
        </div>

        <div class="sol-alert">
          <p style="margin:0 0 8px"><b>Este servicio no atiende emergencias.</b> Si consideras que en este momento te encuentras en peligro o alguna otra persona lo está, por favor comunícate con el número de emergencia de tu ciudad antes de completar la solicitud.</p>
          <p style="margin:0">Una agencia que atiende llamadas 24 horas, domingo a domingo, puede ser contactada en el número <b>01 8000 112 439</b> o a través del WhatsApp <b>300 754 8933</b>.</p>
        </div>

        <p class="sol-prose"><p>Si después de leer estas aclaraciones iniciales deseas pedir una cita de apoyo espiritual con nosotros, es necesario que diligencies este formulario.</p></p>

        <label class="sol-opt" for="gate-acepto" style="margin-top:6px">
          <input type="checkbox" id="gate-acepto">
          <span>He leído y acepto las aclaraciones anteriores y deseo continuar con la solicitud de cita.</span>
        </label>
        <p class="sol-err" id="err_gate">Debes aceptar para poder continuar.</p>

        <div class="sol-gate__acts">
          <button class="sol-submit" id="gate-continuar" style="max-width:280px">Continuar con la solicitud →</button>
        </div>
      </section>
    `;
    document.getElementById("gate-continuar").addEventListener("click", () => {
      const ok = document.getElementById("gate-acepto").checked;
      document.getElementById("err_gate").style.display = ok ? "none" : "block";
      if (ok) renderForm();
    });
  }

  /* ============================================================
     PASO 2 — FORMULARIO
     ============================================================ */
  function renderForm() {
    root.innerHTML = `
      <header class="sol-hero">
        <div class="sol-hero__logo">CS</div>
        <h1>Solicitud de cita de apoyo espiritual</h1>
        <p>Diligencia el formulario. Los campos con <span class="req">*</span> son obligatorios.</p>
      </header>

      <form id="sol-form" novalidate>

        <!-- DATOS BÁSICOS -->
        <section class="sol-card sol-card--banner">
          <p class="sol-section-title">Datos personales</p>
          ${q("correo", "Correo electrónico", `<input type="email" class="sol-input" name="correo" placeholder="tucorreo@email.com" autocomplete="email">`, { req: true, type: "text", errMsg: "Escribe un correo válido." })}
          <div class="sol-grid2">
            ${q("nombre", "Nombre", `<input type="text" class="sol-input" name="nombre" placeholder="Nombre(s)" autocomplete="given-name">`, { req: true, type: "text" })}
            ${q("apellido", "Apellido", `<input type="text" class="sol-input" name="apellido" placeholder="Apellido(s)" autocomplete="family-name">`, { req: true, type: "text" })}
          </div>
          ${q("congrega", "¿Te congregas en Casa Sobre la Roca?", optList("congrega", ["Sí", "No", "Me congrego en otro lugar"], "radio"), { req: true, type: "radio" })}
          ${q("edad", "¿En qué rango de edad te encuentras?", `<div class="sol-opts sol-opts--grid">${RANGOS.map((r, i) => `<label class="sol-opt" for="edad_${i}"><input type="radio" id="edad_${i}" name="edad" value="${esc(r)}"><span>${esc(r)}</span></label>`).join("")}</div>`, { req: true, type: "radio" })}
          ${q("celular", "Número de celular", `<input type="tel" class="sol-input" name="celular" placeholder="Ej. 300 123 4567" autocomplete="tel">`, { req: true, type: "text" })}
          ${q("ciudad", "Ciudad / sede donde te congregas", `<input type="text" class="sol-input" name="ciudad" list="sol-ciudades" placeholder="Escribe o elige tu ciudad"><datalist id="sol-ciudades">${CIUDADES.map(c => `<option value="${esc(c)}">`).join("")}</datalist>`, { req: true, type: "text" })}
          ${q("estadoCivil", "Estado civil", `<div class="sol-opts sol-opts--grid">${ESTADO_CIVIL.map((e, i) => `<label class="sol-opt" for="ec_${i}"><input type="radio" id="ec_${i}" name="estadoCivil" value="${esc(e)}"><span>${esc(e)}</span></label>`).join("")}</div>`, { req: true, type: "radio" })}
        </section>

        <!-- INFORMACIÓN ESPIRITUAL -->
        <section class="sol-card">
          <p class="sol-section-title">Información espiritual</p>
          ${q("tiempo", "¿Cuánto tiempo llevas asistiendo a Casa Roca?", optList("tiempo", TIEMPO, "radio"), { req: true, type: "radio" })}
          ${q("ministerios", "¿En cuál ministerio te congregas?", optList("ministerios", MINISTERIOS, "checkbox"), { req: true, type: "checkbox", errMsg: "Selecciona al menos una opción." })}
          ${q("voluntariado", "¿Eres voluntario (a) en algún ministerio de la iglesia?", optList("voluntariado", VOLUNTARIADO, "checkbox"), { req: true, type: "checkbox", errMsg: "Selecciona al menos una opción." })}
          ${q("procesos", "¿Qué procesos de crecimiento espiritual has hecho en Casa Roca?", optList("procesos", PROCESOS, "checkbox"), { req: true, type: "checkbox", errMsg: "Selecciona al menos una opción." })}
        </section>

        <!-- SOLICITUD -->
        <section class="sol-card">
          <p class="sol-section-title">Tu solicitud</p>
          ${q("motivo", "Cuéntanos el motivo de tu solicitud", `<textarea class="sol-textarea" name="motivo" placeholder="Describe brevemente lo que deseas trabajar en consejería"></textarea>`, { req: true, type: "text", errMsg: "Cuéntanos brevemente el motivo." })}
          ${q("caracter", "Carácter de la solicitud", optList("caracter", CARACTER, "radio"), { req: true, type: "radio" })}
          ${q("tema", "¿Cuál de los siguientes temas se identifica más con tu solicitud?", optList("tema", TEMAS, "radio"), { req: true, type: "radio" })}
          ${q("quien", "Si la consulta es matrimonial, de pareja o noviazgo, ¿quién asiste a la cita?", optList("quien", QUIEN, "radio"), { type: "radio", help: "Responde solo si aplica a tu caso." })}
          ${q("algo", "¿Algo que consideras importante mencionar?", `<textarea class="sol-textarea" name="algo" placeholder="Opcional"></textarea>`, { type: "text" })}
        </section>

        <!-- CONTACTO ADICIONAL -->
        <section class="sol-card">
          <p class="sol-section-title">Contacto adicional</p>
          ${q("contactoNombre", "Nombre y apellido de un contacto adicional (diferente al tuyo)", `<input type="text" class="sol-input" name="contactoNombre" placeholder="Nombre y apellido">`, { req: true, type: "text" })}
          ${q("contactoTel", "Número de celular del contacto", `<input type="tel" class="sol-input" name="contactoTel" placeholder="Ej. 300 123 4567">`, { req: true, type: "text" })}
        </section>

        <!-- EVALUACIÓN (últimas 4 semanas) -->
        <section class="sol-card">
          <p class="sol-section-title">Evaluación de las últimas 4 semanas</p>
          <p class="sol-lead">Las siguientes preguntas tienen el objetivo de saber si en las últimas 4 semanas has sufrido un evento inesperado que te ha llevado a experimentar un cambio drástico en tu vida normal. Selecciona una opción para cada pregunta.</p>
          ${EVAL.map(e => q(e.id, e.t, optList(e.id, ESCALA, "radio"), { req: true, type: "radio" })).join("")}
        </section>

        <!-- HORARIO Y MODALIDAD -->
        <section class="sol-card">
          <p class="sol-section-title">Horario y modalidad</p>
          ${q("modalidad", "¿En qué horario y modalidad prefieres tener el servicio de apoyo en consejería?", optList("modalidad", MODALIDAD, "radio"), { req: true, type: "radio", help: "Para algunos temas de solicitud, NO APLICA atención virtual. Ten en cuenta que estos son los ÚNICOS horarios de atención.", helpStrong: true })}
        </section>

        <!-- CONSENTIMIENTO INFORMADO -->
        <section class="sol-card sol-card--banner">
          <p class="sol-section-title">Consentimiento informado</p>
          <p class="sol-lead">Los siguientes enlaces te permiten ver y descargar los consentimientos informados.</p>

          <div class="sol-consent-block">
            <h3>Si la cita es para un mayor de edad, por favor leer:</h3>
            <p>Consentimiento informado para adulto: <a href="${CONSENT.adulto}" target="_blank" rel="noopener">abrir documento</a></p>
            <p>Consentimiento de atención virtual para adulto: <a href="${CONSENT.adultoVirtual}" target="_blank" rel="noopener">abrir documento</a></p>
          </div>
          <div class="sol-consent-block">
            <h3>Si la cita es para un menor de edad, por favor leer:</h3>
            <p>Consentimiento informado para menores: <a href="${CONSENT.menor}" target="_blank" rel="noopener">abrir documento</a></p>
            <p>Consentimiento de atención virtual para menores: <a href="${CONSENT.menorVirtual}" target="_blank" rel="noopener">abrir documento</a></p>
          </div>

          ${q("consentimiento", "Confirmación", `<label class="sol-opt" for="consent-acepto"><input type="checkbox" id="consent-acepto" name="consentimiento" value="acepto"><span>Al seleccionar esta casilla confirmo que he leído, o que alguien me ha leído, y entiendo y acepto el consentimiento informado para recibir apoyo espiritual por parte de la iglesia. De igual manera confirmo que me adhiero a las políticas de la iglesia para realizar dicho apoyo espiritual en forma presencial, virtual o de manera mixta.</span></label>`, { req: true, type: "checkbox", errMsg: "Debes aceptar el consentimiento informado para enviar la solicitud." })}
        </section>

        <div class="sol-actions">
          <button type="submit" class="sol-submit" id="sol-enviar">Enviar solicitud al equipo de consejería</button>
          <p class="sol-note">Al enviar, tu solicitud llega directamente al Director y Coordinador de Consejería de tu sede.</p>
        </div>
      </form>
    `;
    document.getElementById("sol-form").addEventListener("submit", onSubmit);
  }

  /* ---------------- lectura del formulario ---------------- */
  function val(name) { const el = root.querySelector(`[name="${name}"]`); return el ? el.value.trim() : ""; }
  function radioVal(name) { const el = root.querySelector(`input[name="${name}"]:checked`); return el ? el.value : ""; }
  function checkVals(name) { return Array.from(root.querySelectorAll(`input[name="${name}"]:checked`)).map(e => e.value); }
  function isChecked(name) { const el = root.querySelector(`input[name="${name}"]`); return !!(el && el.checked); }

  function setErr(qid, on) {
    const wrap = root.querySelector(`[data-q="${qid}"]`);
    if (wrap) wrap.classList.toggle("is-error", !!on);
    return on;
  }

  /* ---------------- validación ---------------- */
  function validate() {
    let firstBad = null;
    root.querySelectorAll(".sol-q[data-req='1']").forEach(wrap => {
      const qid = wrap.getAttribute("data-q");
      const type = wrap.getAttribute("data-type");
      let ok;
      if (type === "radio") ok = !!radioVal(qid);
      else if (type === "checkbox") ok = (qid === "consentimiento") ? isChecked("consentimiento") : checkVals(qid).length > 0;
      else {
        const v = val(qid);
        ok = !!v;
        if (ok && qid === "correo") ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      }
      setErr(qid, !ok);
      if (!ok && !firstBad) firstBad = wrap;
    });
    if (firstBad && firstBad.scrollIntoView) firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
    return !firstBad;
  }

  /* ---------------- derivaciones ---------------- */
  function edadNum(rango) {
    const m = String(rango).match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  function esMenor(rango, caracter) {
    return /menor de edad/i.test(rango || "") || /Soy menor de edad/i.test(caracter || "");
  }
  function generoDe(quien) { return quien === "Mujer" ? "F" : quien === "Hombre" ? "M" : undefined; }

  /* puntaje de la evaluación (0..3 por pregunta) → riesgo y prioridad */
  function evaluarRiesgo(respuestas, tema) {
    const peso = r => Math.max(0, ESCALA.indexOf(r)); // 0..3
    const total = EVAL.reduce((s, e) => s + peso(respuestas[e.id]), 0); // 0..12
    const critica = peso(respuestas.ev3) >= 2 || peso(respuestas.ev2) >= 3; // señales fuertes
    let prioridad = "baja", riesgo = "bajo";
    if (critica || total >= 7) { prioridad = "alta"; riesgo = "alto"; }
    else if (total >= 3) { prioridad = "media"; riesgo = "medio"; }
    if (TEMAS_SENSIBLES.indexOf(tema) >= 0 && prioridad === "baja") { prioridad = "media"; riesgo = "medio"; }
    return { total, prioridad, riesgo, critica };
  }

  /* ---------------- envío → BUCKET (bandeja) ---------------- */
  function onSubmit(e) {
    e.preventDefault();
    if (!validate()) { U.toast && U.toast("Revisa las preguntas marcadas en rojo.", false); return; }

    const btn = document.getElementById("sol-enviar");
    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }

    const nombre = val("nombre"), apellido = val("apellido");
    const rango = radioVal("edad"), caracter = radioVal("caracter"), tema = radioVal("tema");
    const quien = radioVal("quien");
    const evalResp = {}; EVAL.forEach(x => evalResp[x.id] = radioVal(x.id));
    const r = evaluarRiesgo(evalResp, tema);
    const ministerios = checkVals("ministerios");
    const ministerioPrincipal = ministerios.filter(m => m !== "Ninguno")[0] || (val("ciudad") ? val("ciudad") : "Sin ministerio");

    const persona = (nombre + " " + apellido).trim();
    const motivo = val("motivo") || "(Sin motivo escrito)";

    /* objeto que cae en la bandeja del coordinador/director */
    const nueva = {
      // campos que usa la bandeja directamente
      persona,
      tel: val("celular"),
      correo: val("correo"),
      edad: edadNum(rango),
      genero: generoDe(quien),
      ministerio: ministerioPrincipal,
      tipo: TEMA_TIPO[tema] || "espiritual",
      motivo,
      prioridad: r.prioridad,
      estado: "solicitada",
      consejero: null,
      etapaProceso: "asignado",
      confidencial: true,
      // metadatos del origen y banderas
      origen: "Formulario web",
      menor: esMenor(rango, caracter),
      riesgo: r.riesgo,
      crisis: r.riesgo === "alto",
      modalidad: /Virtual/i.test(radioVal("modalidad")) ? "virtual" : "presencial",
      // detalle completo del formulario (para el modal de gestión)
      formulario: {
        correo: val("correo"),
        nombre, apellido,
        congrega: radioVal("congrega"),
        rangoEdad: rango,
        celular: val("celular"),
        ciudad: val("ciudad"),
        estadoCivil: radioVal("estadoCivil"),
        tiempoAsistencia: radioVal("tiempo"),
        ministerios,
        voluntariado: checkVals("voluntariado"),
        procesos: checkVals("procesos"),
        motivo,
        caracter,
        tema,
        quienAsiste: quien,
        algoImportante: val("algo"),
        contactoNombre: val("contactoNombre"),
        contactoTel: val("contactoTel"),
        evaluacion: EVAL.map(x => ({ pregunta: x.t, respuesta: evalResp[x.id] })),
        evaluacionPuntaje: r.total,
        riesgo: r.riesgo,
        modalidad: radioVal("modalidad"),
        consentimiento: true,
        enviadoEl: new Date().toISOString(),
      },
    };

    try {
      const guardada = S.addConsejeria(nueva); // ← entra EN VIVO a la bandeja
      renderDone(guardada, r);
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = "Enviar solicitud al equipo de consejería"; }
      U.toast && U.toast("Hubo un problema al enviar. Intenta de nuevo.", false);
    }
  }

  /* ============================================================
     PASO 3 — CONFIRMACIÓN
     ============================================================ */
  function renderDone(c, r) {
    const alto = r && r.riesgo === "alto";
    root.innerHTML = `
      <section class="sol-card sol-card--banner sol-done">
        <div class="sol-done__check" aria-hidden="true">✓</div>
        <h1>¡Recibimos tu solicitud!</h1>
        <p>Gracias, <b>${esc((c.persona || "").split(" ")[0] || "")}</b>. Tu solicitud de apoyo espiritual fue enviada al <b>Director y Coordinador de Consejería</b> de tu sede. Pronto un consejero será asignado y se pondrán en contacto contigo por el celular o correo que registraste.</p>
        <div class="sol-done__pill">Estado: Solicitada · en la bandeja del equipo de consejería</div>
        ${alto ? `
          <div class="sol-alert" style="text-align:left;margin-top:18px">
            <p style="margin:0 0 6px"><b>Tu solicitud fue marcada como prioritaria.</b> Si en este momento sientes que tu vida o la de alguien más está en peligro, no esperes la cita.</p>
            <p style="margin:0">Llama ya a la línea 24 horas: <b>01 8000 112 439</b> · WhatsApp <b>300 754 8933</b>, o al número de emergencias de tu ciudad.</p>
          </div>` : ""}
        <p class="sol-done__verse">“Dios sigue obrando, aunque no siempre como esperamos. El mayor milagro es la transformación del corazón.” — Hebreos 13:8</p>
        <div class="sol-gate__acts" style="justify-content:center">
          <button class="sol-btn-ghost" id="sol-otra">Enviar otra solicitud</button>
        </div>
      </section>
    `;
    const btn = document.getElementById("sol-otra");
    if (btn) btn.addEventListener("click", () => { window.scrollTo(0, 0); renderGate(); });
    window.scrollTo(0, 0);
  }

  /* ---------------- arranque ---------------- */
  if (!S || typeof S.addConsejeria !== "function") {
    root.innerHTML = `<section class="sol-card"><h2>No se pudo cargar el sistema de consejería</h2><p class="sol-lead">Revisa que consejeria-data.js esté disponible.</p></section>`;
  } else {
    renderGate();
  }
})();
