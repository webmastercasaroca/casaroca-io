/* ============================================================
   CASA ROCA · ARRANQUE DEL MASTER CONTRA LA API

   Va el ÚLTIMO de todos a propósito: el master ya se dibujó con lo que
   tenía, y esto lo sustituye por lo real en cuanto el servidor contesta.

   ⛔ Por qué no se espera a la API antes de dibujar. Si se esperara, una
   API caída dejaría la pantalla en blanco, y el sitio publicado en
   Netlify (que no tiene servidor) no abriría nunca. Se dibuja primero y
   se corrige después: la pantalla siempre responde, y cuando llega el
   dato de verdad se repinta y se dice en la cabecera.
   ============================================================ */
(function () {
  "use strict";
  const API = window.CASAROCA_API_CLIENTE;
  if (!API || !API.hayApi) return;             // modo demostración, y se anuncia solo

  function aviso(texto, tono) {
    const d = document.createElement("div");
    d.style.cssText =
      "position:fixed;left:16px;bottom:16px;z-index:9999;max-width:340px;" +
      "background:" + (tono === "mal" ? "#fff5f5" : "#f2f9f4") + ";" +
      "border:1px solid " + (tono === "mal" ? "#f0c9c9" : "#c9e3d2") + ";" +
      "border-radius:10px;padding:12px 14px;font:400 12.5px/19px Inter,system-ui,sans-serif;" +
      "color:#33333a;box-shadow:0 6px 18px rgba(0,0,0,.08)";
    d.innerHTML = texto;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 9000);
  }

  window.addEventListener("load", async function () {
    try {
      const datos = await API.hidratar();
      if (!window.MSTORE.hidratar(datos)) throw new Error("La API contestó algo que no reconozco.");
      /* Y QUIÉN opera, no solo QUÉ se ve. Sin esto la cabecera decía
         «0 módulos», porque el master seguía preguntando por el id de la
         semilla y la base no lo conoce. */
      if (window.MASTER && datos.yo) window.MASTER.fijarYo(datos.yo);
      if (window.MASTER) window.MASTER.repintar();
      const n = datos.personas.length, s = datos.sedes.length;
      aviso("<b>Conectado a la base de datos.</b><br>" +
            s + " iglesias y " + n + " personas del censo real. " +
            "Lo que ve ya no es el juego de demostración.");
    } catch (e) {
      /* ⛔ Un fallo aquí NO tumba la pantalla: se sigue con el juego
         sembrado y se dice claro. Lo que no se puede hacer es seguir
         callado, porque entonces alguien toma decisiones con cifras
         de mentira creyendo que son reales. */
      const porQue = e && e.estado === 401
        ? "La API no sabe quién entró. Abra el master desde el centro de mando."
        : (e && e.message) || "No contestó.";
      aviso("<b>Sin conexión con la API.</b><br>" + porQue +
            "<br>Sigue viendo el <b>juego de demostración</b>.", "mal");
      console.warn("[arranque] la API no respondió:", e);
    }
  });
})();
