/* ============================================================
   CASA ROCA · CONSEJERÍA — HELPERS DE UI COMPARTIDOS (window.CSUI)
   Reutiliza los componentes .dr- (director.css) re-acentuados por
   el tema .cs (consejeria.css). Lo cargan las 3 apps de consejería
   (consejero, coordinador, director) para no duplicar gráficas,
   modales ni el shell. DOM esperado: #cs-app, #cs-modal, #cs-toasts.
   ============================================================ */
(function () {
  "use strict";

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;
  const app = () => document.getElementById("cs-app");
  const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };

  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DOW = ["L", "M", "X", "J", "V", "S", "D"];
  const PALETA = ["var(--cs-teal)", "var(--mostaza-500)", "var(--azul-500)", "var(--exito)", "#C2569B", "var(--peligro)", "var(--azul-700)"];

  function iniciales(nombre) { const p = String(nombre || "").trim().split(/\s+/); return ((p[0] || "")[0] || "" ).toUpperCase() + ((p[1] || "")[0] || "").toUpperCase(); }
  function fechaCorta(iso) { if (!iso) return "—"; const d = new Date(iso + "T00:00"); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; }
  function fechaRel(iso) { if (!iso) return "—"; const d = new Date(iso + "T00:00"); const h = new Date(); h.setHours(0,0,0,0); const dd = Math.round((d - h) / 86400000); if (dd === 0) return "hoy"; if (dd === 1) return "mañana"; if (dd === -1) return "ayer"; if (dd > 0) return `en ${dd} días`; return `hace ${-dd} días`; }
  function diasDesde(iso) { if (!iso) return 0; const d = new Date(iso + "T00:00"); const h = new Date(); h.setHours(0,0,0,0); return Math.round((h - d) / 86400000); }
  function pesoKB(b) { if (!b) return "—"; return b > 1048576 ? (b/1048576).toFixed(1)+" MB" : Math.max(1, Math.round(b/1024))+" KB"; }

  /* ---------------- gráficas (.dr- de director.css) ---------------- */
  function _card(title, sub, body) { return `<div class="dr-card"><h3 class="dr-card__t">${esc(title)}</h3>${sub ? `<p class="dr-card__sub">${sub}</p>` : ""}${body}</div>`; }
  function _legend(items, total) { return `<ul class="dr-legend">${items.map(s => `<li><i style="background:${s.color}"></i><span>${esc(s.lbl)}</span><b>${s.v}</b>${total ? `<em>${pct(s.v, total)}%</em>` : ""}</li>`).join("")}</ul>`; }

  function kpi(n, lbl, alerta) { return `<div class="dr-kpi ${alerta ? "is-alerta" : ""}"><div class="dr-kpi__n">${n}</div><div class="dr-kpi__l">${esc(lbl)}</div></div>`; }

  function donut(title, sub, segs) {
    const total = segs.reduce((s, x) => s + x.v, 0) || 1, r = 52, C = 2 * Math.PI * r; let off = 0;
    const arcs = segs.map(s => { const len = (s.v / total) * C; const el = `<circle class="dr-donut__seg" cx="60" cy="60" r="${r}" stroke="${s.color}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; return el; }).join("");
    return _card(title, sub, `<div class="dr-donut"><div class="dr-donut__chart"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(title)}"><g transform="rotate(-90 60 60)">${arcs}</g></svg><div class="dr-donut__center"><b>${total}</b><span>total</span></div></div>${_legend(segs, total)}</div>`);
  }
  function columns(title, sub, rows, colorFn) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return _card(title, sub, `<div class="dr-cols">${rows.map(r => `<div class="dr-col"><span class="dr-col__v">${r.v}</span><div class="dr-col__track"><div class="dr-col__bar" style="height:${Math.max(2, pct(r.v, max))}%;background:${colorFn ? colorFn(r) : "var(--cs-teal)"}"></div></div><span class="dr-col__l">${esc(r.lbl)}</span></div>`).join("")}</div>`);
  }
  function lineArea(title, sub, pts, color) {
    const W = 320, H = 130, pX = 18, pT = 20, pB = 26, n = pts.length;
    const max = Math.max(1, ...pts.map(p => p.v));
    const X = i => pX + (i * (W - 2 * pX) / Math.max(1, n - 1));
    const Y = v => (H - pB) - (v / max) * (H - pT - pB);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
    const area = `M${X(0).toFixed(1)},${H - pB} ` + pts.map((p, i) => `L${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ") + ` L${X(n - 1).toFixed(1)},${H - pB} Z`;
    const dots = pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3.2"/>`).join("");
    const vl = pts.map((p, i) => `<text class="dr-line__v" x="${X(i).toFixed(1)}" y="${(Y(p.v) - 7).toFixed(1)}">${p.v}</text>`).join("");
    const xl = pts.map((p, i) => `<text class="dr-line__x" x="${X(i).toFixed(1)}" y="${H - 8}">${esc(p.lbl)}</text>`).join("");
    return _card(title, sub, `<svg class="dr-line" style="--lc:${color || "var(--cs-teal)"}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><path class="dr-line__area" d="${area}"/><path class="dr-line__path" d="${line}"/><g class="dr-line__dots">${dots}</g>${vl}${xl}</svg>`);
  }
  function gauges(title, sub, items) {
    const r = 25, C = 2 * Math.PI * r;
    const cells = items.map(it => { const v = Math.min(100, it.v), len = (v / 100) * C; return `<div class="dr-gauge"><svg viewBox="0 0 64 64"><circle class="dr-gauge__bg" cx="32" cy="32" r="${r}"/><circle class="dr-gauge__fg" cx="32" cy="32" r="${r}" stroke="${it.color}" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" transform="rotate(-90 32 32)"/><text class="dr-gauge__v" x="32" y="36">${it.v}%</text></svg><div class="dr-gauge__l">${esc(it.lbl)}</div></div>`; }).join("");
    return _card(title, sub, `<div class="dr-gauges">${cells}</div>`);
  }
  function lollipop(title, sub, rows, colorFn) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return _card(title, sub, `<div class="dr-lollis">${rows.map(r => { const w = pct(r.v, max), c = colorFn ? colorFn(r) : "var(--cs-teal)"; return `<div class="dr-lolli"><div class="dr-lolli__lbl">${esc(r.lbl)}</div><div class="dr-lolli__track"><span class="dr-lolli__line" style="width:${w}%;background:${c}"></span><span class="dr-lolli__dot" style="left:${w}%;background:${c}"></span></div><div class="dr-lolli__v">${r.v}</div></div>`; }).join("")}</div>`);
  }
  function funnel(title, sub, steps) {
    const max = Math.max(1, ...steps.map(s => s.v));
    return _card(title, sub, `<div class="dr-funnel">${steps.map(s => `<div class="dr-funnel__bar" style="width:${Math.max(14, pct(s.v, max))}%;background:${s.color}"><span class="dr-funnel__lbl">${esc(s.lbl)}</span><span class="dr-funnel__v">${s.v}</span></div>`).join("")}</div>`);
  }

  /* ---------------- chips ---------------- */
  function tipoChip(tid) { const t = window.CONSE.tipo(tid); return `<span class="dr-chip" style="color:${t.color};background:color-mix(in srgb, ${t.color} 14%, white)">${t.emoji} ${esc(t.nombre)}</span>`; }
  function estadoChip(eid) { const e = window.CONSE.estado(eid); return `<span class="ps-estado ps-estado--${e.color}">${esc(e.nombre)}</span>`; }
  function prioChip(pid) { const p = window.CONSE.prioridad(pid); return `<span class="cs-prio" style="--pc:${p.color}">${esc(p.nombre)}</span>`; }

  /* ---------------- login / shell ---------------- */
  function login(opts) {
    return `
    <div class="dr-login">
      <div class="dr-login__card">
        <div class="dr-login__logo cs-logo">${opts.logo || "CS"}</div>
        <h1>${esc(opts.titulo)}</h1>
        <p>${esc(opts.lead)}</p>
        <button class="dr-google" id="cs-google">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuar con Google
        </button>
        <div class="dr-login__nota">🔒 Demo Fase 0 — entrarás como <b>${esc(opts.user.nombre)}</b>, ${esc(opts.user.rol)}.</div>
      </div>
    </div>`;
  }

  function shell(opts, contenidoHTML) {
    const { user, nav, vista, sub } = opts;
    return `
    <header class="dr-topbar">
      <div class="dr-brand">
        <div class="dr-brand__logo cs-logo">${opts.logo || "CS"}</div>
        <div class="dr-brand__txt"><b>Casa Roca</b><small>${esc(sub)}</small></div>
      </div>
      <div class="dr-topbar__sp"></div>
      <div class="dr-user">
        <div class="dr-user__name">${esc(user.nombre)}<span>${esc(user.rol)}</span></div>
        <div class="dr-avatar" title="${esc(user.nombre)}">${esc(user.iniciales)}</div>
        <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="salir">Salir</button>
      </div>
    </header>
    <div class="dr-shell">
      <nav class="dr-nav" aria-label="Secciones de Consejería">
        ${nav.map(n => `<button class="dr-nav__item ${vista === n.id ? "is-active" : ""}" data-accion="ir" data-vista="${n.id}" ${vista === n.id ? 'aria-current="page"' : ""}>
          <span class="dr-nav__ic" aria-hidden="true">${n.ico}</span><span class="dr-nav__lbl">${n.lbl}</span></button>`).join("")}
      </nav>
      <main class="dr-main" id="main">${contenidoHTML}</main>
    </div>`;
  }

  function head(h1, lead, derecha, live) {
    return `<div class="dr-head"><div><h1 class="dr-h1">${esc(h1)}</h1><p class="dr-lead">${lead}</p></div>${live ? `<span class="dr-tag cs-live">● En vivo · ${esc(new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }))}</span>` : (derecha || "")}</div>`;
  }

  /* ---------------- modal / toast ---------------- */
  function abrirModal(html) {
    const wrap = document.getElementById("cs-modal");
    wrap.innerHTML = `<div class="dr-modalbg" id="cs-modalbg"><div class="dr-modal" role="dialog" aria-modal="true" aria-labelledby="cs-modal-t">${html}</div></div>`;
    document.getElementById("cs-modalbg").addEventListener("click", e => { if (e.target.id === "cs-modalbg") cerrarModal(); });
    document.addEventListener("keydown", escClose);
  }
  function cerrarModal() { const w = document.getElementById("cs-modal"); if (w) w.innerHTML = ""; document.removeEventListener("keydown", escClose); }
  function escClose(e) { if (e.key === "Escape") cerrarModal(); }
  function toast(msg, ok) {
    const wrap = document.getElementById("cs-toasts"); if (!wrap) return;
    const el = document.createElement("div");
    el.className = "dr-toast" + (ok ? " dr-toast--ok" : "");
    el.innerHTML = `<span>${ok ? "✓" : "ℹ️"}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 250); }, 3000);
  }

  /* ---------------- asistente IA (placeholder compartido) ---------------- */
  function asistenteIA(opts) {
    opts = opts || {};
    const sugeridas = opts.sugeridas || csaSugeridas(4);
    const base = (window.CONSESTORE ? window.CONSESTORE.conocimiento() : []);
    return `
    <div class="dr-head"><div>
      <h1 class="dr-h1">Asistente de conocimiento <span class="cs-badge-beta">IA</span></h1>
      <p class="dr-lead">${esc(opts.lead || "Pregúntale a la base de conocimiento de consejería. Responde con lo que la Dirección ha cargado: protocolos, guías y respuestas a preguntas frecuentes.")}</p>
    </div><span class="dr-tag cs-live">● ${base.length} recursos conectados</span></div>

    <div class="csa">
      <div class="csa__main">
        <div class="csa__thread" id="csa-thread">
          <div class="csa__msg csa__msg--bot">
            <div class="csa__ava">🤲</div>
            <div class="csa__bub">
              <p>Hola 👋 Soy tu asistente de consejería. Pregúntame y te respondo con lo que hay en la base (${base.length} recursos). Cuéntame el tema o pega la pregunta de la persona.</p>
            </div>
          </div>
        </div>
        <form class="csa__compose" data-accion="csa-enviar">
          <input id="csa-input" class="csa__input" type="text" placeholder="Escribe tu pregunta…" autocomplete="off" />
          <button type="submit" class="dr-btn dr-btn--primary csa__send">Enviar</button>
        </form>
      </div>
      <aside class="csa__side">
        <div class="dr-card">
          <h3 class="dr-card__t">📚 Base conectada</h3>
          <p class="dr-card__sub">${base.length} recurso${base.length === 1 ? "" : "s"} que alimentarán al asistente</p>
          <ul class="csa__sources">
            ${base.slice(0, 8).map(k => `<li><span>${k.ico || "📄"}</span><div><b>${esc(k.titulo)}</b><small>${esc(k.categoria)} · ${esc(k.tipo)}</small></div></li>`).join("") || '<li class="csa__empty">Aún no hay recursos cargados.</li>'}
          </ul>
        </div>
      </aside>
    </div>`;
  }
  /* ---------------- motor del asistente (recuperación sobre el conocimiento) ----------------
     Agente relacional, sin guiones: busca en la base de consejería los
     recursos/FAQs más afines a la pregunta y devuelve su orientación. */
  const CSA_STOP = new Set("a al algo alguien ante aqui como con cual cuales cuando cuanto de del e el ella ello en entre era es esa ese eso esta este esto fue ha hace hacer hacia hay la las le les lo los mas me mi mucho muy no nos o os para pero por porque que quien se segun si sin so sobre su sus te tu un una uno unos unas y ya quiero necesito ayuda persona aconseja aconsejar decir digo".split(/\s+/));
  function _norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function _tokens(q) { return _norm(q).split(/[^a-z0-9ñ]+/).filter(t => t.length >= 3 && !CSA_STOP.has(t)); }
  function csaBuscar(q) {
    const base = window.CONSESTORE ? window.CONSESTORE.conocimiento() : [];
    const terms = _tokens(q);
    if (!terms.length || !base.length) return [];
    return base.map(k => {
      const tit = _norm(k.titulo), des = _norm(k.desc), cat = _norm(k.categoria);
      let s = 0;
      terms.forEach(t => { const stem = t.length > 6 ? t.slice(0, 6) : t; if (tit.indexOf(stem) >= 0) s += 5; if (cat.indexOf(stem) >= 0) s += 2; if (des.indexOf(stem) >= 0) s += 1; });
      return { item: k, score: s };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  }
  function _append(thread, cls, html) { const d = document.createElement("div"); d.className = "csa__msg " + cls; d.innerHTML = html; thread.appendChild(d); }
  function csaResponder(q) {
    const thread = document.getElementById("csa-thread"); if (!thread) return;
    _append(thread, "csa__msg--user", `<div class="csa__bub">${esc(q)}</div><div class="csa__ava csa__ava--u">Tú</div>`);
    const res = csaBuscar(q);
    const best = res[0];
    const qCorto = q.trim().length > 80 ? q.trim().slice(0, 80) + "…" : q.trim();
    let body;
    /* umbral de confianza: solo responde si hay una coincidencia clara (toca el título
       o varias veces el contenido). Si no, NO inventa: lo dice y pide reformular. */
    if (!best || best.score < 4) {
      body = `<p>Leí tu mensaje sobre «${esc(qCorto)}», pero no encuentro algo específico en la base de consejería sobre eso. ¿Puedes decirme el tema central en pocas palabras? (por ejemplo: <i>perdón, ansiedad, culpa, duelo, miedo, identidad, familia, pareja, fe</i>).</p><p class="csa__hint">Si es un caso delicado o de crisis, escálalo al <b>Pastor Franklin Peña</b> (Dirección de Consejería).</p>`;
    } else {
      const top = best.item;
      body = `<p>Sobre lo que me cuentas — «${esc(qCorto)}» — esto es lo que dice la base de consejería:</p>
        <div class="csa-ans"><div class="csa-ans__t">${top.ico || "📄"} ${esc(top.titulo)}</div><p>${esc(top.desc)}</p><div class="csa-ans__src">📚 ${esc(top.categoria)} · base de consejería</div></div>`;
    }
    _append(thread, "csa__msg--bot", `<div class="csa__ava">🤲</div><div class="csa__bub">${body}</div>`);
    thread.scrollTop = thread.scrollHeight;
  }
  /* sugerencias = preguntas reales de la base */
  function csaSugeridas(n) {
    const base = (window.CONSESTORE ? window.CONSESTORE.conocimiento() : []).filter(k => /^¿/.test(k.titulo));
    const out = []; const used = {};
    while (out.length < (n || 3) && out.length < base.length) { const i = Math.floor(Math.random() * base.length); if (used[i]) continue; used[i] = 1; out.push(base[i].titulo); }
    return out.length ? out : ["¿Cómo aconsejar a alguien que no logra perdonar?", "¿Cómo orientar a alguien que tiene miedo del futuro?", "¿Qué decir a una persona que vive atormentada por la culpa?"];
  }

  /* ---------------- botón flotante + modal del asistente ---------------- */
  function fab() {
    return `<button class="csa-fab" data-accion="abrir-asistente" title="Pregúntale al asistente de conocimiento" aria-label="Asistente de conocimiento">
      <span class="csa-fab__ic" aria-hidden="true">🤲</span><span class="csa-fab__txt">Asistente</span>
    </button>`;
  }
  function abrirAsistente() {
    const base = (window.CONSESTORE ? window.CONSESTORE.conocimiento() : []);
    abrirModal(`
      <div class="dr-modal__head"><div class="csa__ava">🤲</div>
        <div><h3 id="cs-modal-t">Asistente de consejería <span class="cs-badge-beta">IA</span></h3>
        <p class="dr-card__sub">Te responde con la base de conocimiento · ${base.length} recursos.</p></div></div>
      <div class="csa csa--modal">
        <div class="csa__main" style="box-shadow:none;border:none">
          <div class="csa__thread" id="csa-thread">
            <div class="csa__msg csa__msg--bot"><div class="csa__ava">🤲</div><div class="csa__bub"><p>Hola 👋 Pregúntame sobre cualquier tema de consejería y te muestro lo que dice la base. Cuéntame qué necesitas.</p></div></div>
          </div>
          <form class="csa__compose" id="csa-modal-form"><input id="csa-input" class="csa__input" type="text" placeholder="Escribe tu pregunta…" autocomplete="off"><button type="submit" class="dr-btn dr-btn--primary csa__send">Enviar</button></form>
        </div>
      </div>
      <div class="dr-modal__acts"><span class="dr-card__sub">📚 ${base.length} recurso(s) en la base · 🔒 confidencial</span><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button></div>
    `);
    const form = document.getElementById("csa-modal-form");
    if (form) form.addEventListener("submit", e => { e.preventDefault(); const inp = document.getElementById("csa-input"); const q = (inp.value || "").trim(); if (!q) return; csaResponder(q); inp.value = ""; });
  }

  window.CSUI = {
    esc, pct, app, val, MESES, MESES_L, DOW, PALETA,
    iniciales, fechaCorta, fechaRel, diasDesde, pesoKB,
    _card, _legend, kpi, donut, columns, lineArea, gauges, lollipop, funnel,
    tipoChip, estadoChip, prioChip,
    login, shell, head, abrirModal, cerrarModal, toast,
    asistenteIA, csaResponder, fab, abrirAsistente,
  };
})();
