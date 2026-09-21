# CasaRoca System · Web

Sitio unificado de la plataforma. **Reúne dos despliegues que estaban separados** y
que por estarlo tenían un fallo en vivo.

## Por qué se unifican

El panel del pastor abre el sistema de Consejería en un **iframe del mismo origen**
(`pastor.js`, vista de Consejería). Pero los archivos `consejeria-*.html` vivían en
otro sitio, así que desde el ecosistema daban **404** — comprobado con `curl`:

```
ecosistemacr.netlify.app/consejeria-director.html  → 404
consejeriacr.netlify.app/consejeria-director.html  → 200
```

Y apuntar el iframe al otro dominio tampoco servía: `X-Frame-Options: SAMEORIGIN`
bloquea el marco entre orígenes distintos. **La única salida era co-desplegarlos**,
que es lo que hace este repositorio.

## De dónde salió el código

| Origen | Archivos | Publicado |
|---|---|---|
| `ecosistemacr.netlify.app` | 60 | 24 jun 2026 |
| `consejeriacr.netlify.app` | 14 propios de consejería | 1 jul 2026 |

Los archivos compartidos entre ambos (`tokens.css`, `store.js`, `mobile.js`…) son
**idénticos byte a byte**: es la misma base de código, solo estaba partida en dos.

El `index.html` sí difería; se conservan los dos — el del ecosistema como `index.html`
y el de consejería como `consejeria.html`.

## Estructura

```
sitio/           lo que se publica
  hub.html       el mapa del sistema — es la portada (redirección de /)
  central.html   Dirección General · 36 sedes
  pastor.html    Pastor de sede
  director.html  Director de ministerio
  lider.html     Líder de grupo
  nicodemo.html  Seguimiento de nuevos
  rocakids-*.html
  consejeria-*.html   ← los que faltaban
  experiencia*.html   landings públicos del recorrido 4C
  assets/
```

## ⚠️ Lo que hay que saber antes de tocarlo

**Este código es el que está PUBLICADO, no el más nuevo.** En
`~/Desktop/CasaRocaSystem Ai/` hay una versión posterior con las 19 modificaciones
que pidió el pastor —unos 42 KB más en `pastor.js`— que nunca se desplegó. Antes de
dar este sitio por bueno hay que decidir cuál de las dos manda.

El sitio sigue marcado `noindex, nofollow`: es un borrador hasta que la iglesia diga
lo contrario.
