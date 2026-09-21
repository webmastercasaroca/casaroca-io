/* ============================================================
   CASA ROCA · ENHANCER MÓVIL GENÉRICO  (mobile.js)
   ------------------------------------------------------------
   No toca la lógica de cada app. En celular:
   1) Convierte la nav superior (.dr-nav / .ni-nav) en una barra
      inferior tipo app (4 secciones + "Más" con hoja completa).
   2) Etiqueta las celdas de las tablas (dr-table/ni-table) con
      data-col para el modo "tarjetas apiladas" de mobile.css.
   Reacciona a los re-render con un MutationObserver.
   Trabaja en conjunto con mobile.css. Seguro de incluir en
   cualquier app: si no hay .dr-nav/.ni-nav, la barra no se crea.
   ============================================================ */
(function () {
  "use strict";

  var MQ = window.matchMedia("(max-width: 760px)");
  var NAV_SEL = ".dr-nav, .ni-nav";
  var ITEM_SEL = ".dr-nav__item, .ni-nav__item";
  var TABLE_SEL = ".dr-table, .ni-table";

  /* -------- utilidades -------- */
  function txt(el) { return (el && el.textContent || "").trim(); }
  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ============================================================
     1. TABLAS  ->  data-col por celda (para tarjetas en móvil)
     ============================================================ */
  function etiquetarTablas() {
    var tablas = document.querySelectorAll(TABLE_SEL);
    tablas.forEach(function (tabla) {
      var ths = tabla.querySelectorAll("thead th");
      if (!ths.length) return;
      var labels = Array.prototype.map.call(ths, function (th) {
        return txt(th).replace(/[▲▼↑↓]/g, "").trim();   // quita glifos de orden
      });
      tabla.querySelectorAll("tbody tr").forEach(function (tr) {
        var celdas = tr.children;
        for (var i = 0; i < celdas.length; i++) {
          var td = celdas[i];
          if (td.hasAttribute("colspan") && td.getAttribute("colspan") !== "1") continue;
          // no sobre-escribir si la app ya puso un data-col propio con texto
          td.setAttribute("data-col", labels[i] != null ? labels[i] : "");
        }
      });
    });
  }

  /* ============================================================
     2. NAV  ->  BARRA INFERIOR + HOJA "MÁS"
     ============================================================ */
  var barra, hoja, hojaPanel;        // nodos persistentes
  var construida = false;

  // Lee los ítems actuales de la nav viva (vista, label, ico, activo) + separadores
  function leerNav() {
    var nav = document.querySelector(NAV_SEL);
    if (!nav) return null;
    var items = [];
    Array.prototype.forEach.call(nav.children, function (el) {
      if (el.matches && el.matches(ITEM_SEL)) {
        var lbl = el.querySelector('[class*="nav__lbl"]');
        var ico = el.querySelector('[class*="nav__ic"]');
        items.push({
          tipo: "item",
          vista: el.getAttribute("data-vista") || "",
          accion: el.getAttribute("data-accion") || "ir",
          lbl: lbl ? txt(lbl) : txt(el),
          ico: ico ? txt(ico) : "•",
          activo: el.classList.contains("is-active")
        });
      } else if (el.classList && el.classList.contains("cn-nav-sep")) {
        items.push({ tipo: "sep", lbl: txt(el) });
      }
    });
    return items;
  }

  function activarVista(it) {
    // Re-localiza el botón real (la nav se recrea en cada render) y lo "clickea"
    var real = document.querySelector(
      ITEM_SEL.split(",").map(function (s) {
        return s.trim() + '[data-vista="' + (window.CSS && CSS.escape ? CSS.escape(it.vista) : it.vista) + '"]';
      }).join(",")
    );
    if (real) { real.click(); }
    cerrarHoja();
  }

  function abrirHoja() { if (hoja) { hoja.classList.add("is-open"); document.body.style.overflow = "hidden"; } }
  function cerrarHoja() { if (hoja) { hoja.classList.remove("is-open"); document.body.style.overflow = ""; } }

  function crearBarra() {
    if (construida) return;
    barra = document.createElement("nav");
    barra.className = "m-tabbar";
    barra.setAttribute("aria-label", "Navegación principal");

    hoja = document.createElement("div");
    hoja.className = "m-sheet";
    hoja.innerHTML = '<div class="m-sheet__panel" role="dialog" aria-label="Todas las secciones">' +
      '<div class="m-sheet__grip"></div></div>';
    hojaPanel = hoja.querySelector(".m-sheet__panel");
    hoja.addEventListener("click", function (e) { if (e.target === hoja) cerrarHoja(); });

    document.body.appendChild(barra);
    document.body.appendChild(hoja);
    construida = true;
  }

  function sincronizar() {
    var items = leerNav();
    if (!items) { if (barra) barra.style.display = "none"; return; }
    if (!MQ.matches) return;            // solo móvil
    crearBarra();
    barra.style.display = "";

    var soloItems = items.filter(function (i) { return i.tipo === "item"; });
    var total = soloItems.length;
    var primarias = total <= 5 ? total : 4;
    var hayMas = total > primarias;
    var enBarra = soloItems.slice(0, primarias);
    var activaEnBarra = enBarra.some(function (i) { return i.activo; });

    /* --- barra inferior --- */
    barra.innerHTML = "";
    enBarra.forEach(function (it) {
      var b = document.createElement("button");
      b.className = "m-tabbar__item" + (it.activo ? " is-active" : "");
      b.innerHTML = '<span class="m-tabbar__ic" aria-hidden="true">' + it.ico + '</span>' +
        '<span class="m-tabbar__lbl">' + it.lbl + '</span>';
      b.addEventListener("click", function () { activarVista(it); });
      barra.appendChild(b);
    });
    if (hayMas) {
      var bm = document.createElement("button");
      bm.className = "m-tabbar__item" + (!activaEnBarra ? " is-active" : "");
      bm.innerHTML = '<span class="m-tabbar__ic" aria-hidden="true">☰</span>' +
        '<span class="m-tabbar__lbl">Más</span>';
      bm.addEventListener("click", abrirHoja);
      barra.appendChild(bm);
    }

    /* --- hoja "Más": lista completa con secciones --- */
    // limpia (conserva grip)
    Array.prototype.slice.call(hojaPanel.querySelectorAll(".m-sheet__item, .m-sheet__title"))
      .forEach(function (n) { n.remove(); });
    var titulo = document.createElement("div");
    titulo.className = "m-sheet__title"; titulo.textContent = "Todas las secciones";
    hojaPanel.appendChild(titulo);
    items.forEach(function (it) {
      if (it.tipo === "sep") {
        var s = document.createElement("div");
        s.className = "m-sheet__title"; s.textContent = it.lbl;
        hojaPanel.appendChild(s); return;
      }
      var b = document.createElement("button");
      b.className = "m-sheet__item" + (it.activo ? " is-active" : "");
      b.innerHTML = '<span class="m-sheet__ic" aria-hidden="true">' + it.ico + '</span>' +
        '<span>' + it.lbl + '</span>';
      b.addEventListener("click", function () { activarVista(it); });
      hojaPanel.appendChild(b);
    });
  }

  /* ============================================================
     3. ORQUESTACIÓN
     ============================================================ */
  var refrescar = debounce(function () { etiquetarTablas(); sincronizar(); }, 60);

  function arrancar() {
    etiquetarTablas();
    sincronizar();
    // Observa cambios en el contenido (re-render de vistas)
    var raiz = document.querySelector(".dr-main, .ni-main, .cn-main") || document.body;
    var obs = new MutationObserver(refrescar);
    obs.observe(document.body, { childList: true, subtree: true });
    // Cambios de orientación / tamaño
    if (MQ.addEventListener) MQ.addEventListener("change", refrescar);
    else if (MQ.addListener) MQ.addListener(refrescar);
    window.addEventListener("orientationchange", refrescar);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancar);
  } else { arrancar(); }
})();
