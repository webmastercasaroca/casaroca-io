# CasaRoca API · Módulo de Nuevos

API sobre el esquema de datos. Implementa las **cinco rutas del documento
M-Nuevos del equipo 100p**, tal cual las especificaron: el contrato es suyo
porque construyen el frontend; la garantía es nuestra porque vive en la base.

```
POST /api/v1/nuevos/registrar              (público)
GET  /api/v1/nuevos/dashboard
POST /api/v1/nuevos/:id/registrar-contacto
POST /api/v1/nuevos/:id/convertir-miembro
GET  /api/v1/nuevos/:id/historial
```

## Cómo se corre

```bash
npm run build
PGUSER=casaroca_api_dev npm start     # levanta en :3000
PGUSER=casaroca_api_dev npm run probar # 13 pruebas de extremo a extremo
```

## La pieza que importa

Una petición = una transacción = un contexto. `DbService.enTransaccion` abre la
transacción, fija `app.persona_id`, `app.sede_ids`, `app.nivel_max` y
`app.alcance_global` con **`SET LOCAL`**, y ejecuta dentro. Nada consulta la base
fuera de ahí.

`SET LOCAL` es deliberado: el valor muere con la transacción. Con `SET` a secas
quedaría pegado a la conexión y la siguiente petición que reutilizara esa conexión
del pool heredaría la sede del usuario anterior. Hay una prueba que alterna dos
pastores de sedes distintas ocho veces seguidas para verificarlo.

La identidad llega hoy en la cabecera `X-Persona-Id`; en producción vendrá en el
token de Keycloak. **Lo único que cambia es una función** — el resto del sistema
trabaja contra el contexto, no contra la cabecera. Y las sedes y el nivel NO vienen
del cliente: se derivan de las asignaciones vigentes con `identidad.contexto_de()`.

## Tres fallos que esta API destapó en el esquema

Ninguno se veía leyendo el SQL. Los tres tienen ahora una vista de control que da
cero filas y una prueba que falla si vuelven.

1. **Las vistas se saltaban el RLS.** Una vista se ejecuta con los permisos de su
   propietario; las nuestras las creó un superusuario. Toda consulta a través de
   una vista devolvía filas de todas las sedes, en silencio. Arreglado con
   `security_invoker` en las 20 vistas.
2. **La capa de permisos no se había concedido a sí misma.** `v_permiso_efectivo`
   no tenía GRANT: la API no podía averiguar quién la llamaba.
3. **Faltaban las secuencias.** Una tabla con `bigserial` no admite INSERT sin
   USAGE sobre su secuencia, y el error no menciona la tabla.

## Estado

- 13 pruebas de extremo a extremo, 13 pasan.
- La conexión usa `casaroca_api_dev`, que **no puede saltar RLS** — hay una prueba
  que lo comprueba.
- Falta: Keycloak, reCAPTCHA en el borde, y los módulos que no son Nuevos.
