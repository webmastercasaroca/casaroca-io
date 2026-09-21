# RUNBOOK · CasaRoca System AI
### Lo que hay que saber hacer cuando algo pasa, escrito para que lo siga alguien que no construyó esto

> 19 de septiembre de 2026 · Se prueba haciendo que **una persona ajena al proyecto lo siga de principio a fin**. Si tropieza, el runbook está mal, no la persona.

---

## 0 · Los cuatro números que hay que tener a mano

| Qué | Dónde |
|---|---|
| Estado del servicio | `GET /salud/detalle` |
| Panel de la nube | Consola de GCP, proyecto `casaroca-prod` |
| Canal de alertas | El que declare `infra/gcp/observabilidad.tf` (`correos_alertas`) |
| Quién responde el domingo | Ver «Guardia dominical», abajo |

## 1 · Arrancar y parar

### Desarrollo, en el portátil
```bash
cd backend
./scripts/arrancar.sh     # PostgreSQL 16 local, puerto 5433
./scripts/migrar.sh       # recrea la base: migraciones + semillas
./scripts/probar.sh       # los 16 bancos de invariantes
cd api && npm run build && node dist/src/main.js
```

### Producción
La API corre en Cloud Run. **No se arranca a mano:** se despliega.
```bash
cd backend && ./scripts/desplegar.sh staging     # primero pruebas
cd backend && ./scripts/desplegar.sh produccion  # solo con la verificación en verde
```
Parar el servicio en una emergencia: bajar el tráfico a cero en Cloud Run (no borrar el servicio, que perdería la configuración).

## 2 · Antes de entregar, fusionar o desplegar
```bash
cd backend && ./scripts/verificar.sh
```
Nueve compuertas. **Una en rojo y no se despliega.** Lo mismo que corre la integración continua.

## 3 · Copia y restauración

```bash
./scripts/respaldar.sh     # copia cifrada, retención 30 días
./scripts/restaurar.sh     # restaura en una base APARTE y la verifica
```

**⛔ La restauración se ejecuta de verdad al menos una vez al mes**, y deja su fecha y su duración en `backend/docs/EVIDENCIA-restauracion.txt`. La compuerta 9 de `verificar.sh` falla si la última tiene más de 45 días. Una copia que nunca se restauró es un archivo, no una copia.

`restaurar.sh` nunca toca la base viva: restaura en `casaroca_restaurada`, cuenta filas, comprueba que no haya fugas de lectura y la borra.

## 4 · Rotar la llave de cifrado (N4)

> ⛔ **Este punto estaba MAL escrito hasta el 19 de septiembre de 2026 y seguirlo destruía datos.**
> Decía: «**No** hay que recifrar los datos: la envoltura usa la versión con la que se cifró cada fila».
> Eso describe un cifrado de sobre con versión por fila. **El sistema no hace eso.** Cifra con
> `pgp_sym_encrypt(dato, llave)` y **una sola llave simétrica** que la aplicación pasa en
> `app.llave_n4`; no se guarda ninguna versión. Rotar sin recifrar deja ilegibles **los códigos de
> entrega de los menores de RocaKids**, y si además se destruye la versión anterior en KMS, la
> pérdida es definitiva. El procedimiento correcto es el de abajo, y **existe como guion**.

Lo que está cifrado hoy (la lista vive en `plataforma.columnas_cifradas`, no en este documento):

| Columna | Qué guarda |
|---|---|
| `nucleo.acudientes.codigo_entrega_cifrado` | Código con el que un acudiente retira a un menor |
| `rocakids.checkins.codigo_cifrado` | Código de entrega emitido al ingresar a la sala |

**Antes de empezar:** la llave vieja tiene que seguir viva en KMS durante todo el proceso. Es lo
único que abre los datos actuales.

1. **Mirar sin tocar.** Dice cuántas filas hay cifradas y cuáles se leen con la llave vigente:

   ```bash
   CASAROCA_LLAVE_VIEJA="$(gcloud secrets versions access latest --secret=llave-n4)" \
   CASAROCA_LLAVE_NUEVA="$(openssl rand -base64 32)" \
   ./scripts/rotar-llave-n4.sh
   ```

   Si aparece alguna fila ilegible **con la llave vieja**, pare: hay datos cifrados con una llave
   que ya no se tiene. Averígüelo antes de seguir; el recifrado no las va a tocar.

2. **Crear la versión nueva en KMS** y guardarla en Secret Manager, *sin desplegar todavía*.

3. **Recifrar.** Descifra con la vieja y vuelve a cifrar con la nueva, fila por fila. Se puede
   cortar a la mitad y volver a correr: lo que ya está con la llave nueva no se toca.

   ```bash
   CASAROCA_LLAVE_VIEJA=... CASAROCA_LLAVE_NUEVA=... ./scripts/rotar-llave-n4.sh --aplicar
   ```

4. **Comprobar.** El propio guion lo hace y se planta si algo queda ilegible. La regla es
   literal: **cero ilegibles con la llave nueva, o no se sigue.**

5. **Desplegar** la revisión de Cloud Run con el secreto nuevo.

6. **Probar una entrega de verdad** en RocaKids (un check-in y su entrega con código) antes de
   dar la rotación por buena.

7. **Solo entonces** programar la destrucción de la versión anterior en KMS. Nunca antes del
   punto 6. Google la destruye 24 h después de pedirlo: ese es el último punto de rescate.

8. **Anotar** la rotación en `docs/DECISIONES/` con fecha, responsable y el resultado de la
   comprobación del punto 4.

**Si algo sale mal a mitad de camino:** no hay que deshacer nada. Mientras la llave vieja exista,
`rotar-llave-n4.sh --aplicar` se vuelve a correr y termina el trabajo; y si hace falta volver
atrás, se corre con las dos llaves al revés.

### Custodia de la llave: quién la tiene y qué pasa si se pierde

La llave N4 vive en **Cloud KMS** y llega a la aplicación por **Secret Manager**. Nunca en el
código, ni en el entorno de una máquina personal, ni en la base.

- **Quién puede leerla:** solo la cuenta de servicio de Cloud Run y el rol de administración de
  la central. Cualquier otro acceso es un incidente (punto 11).
- **Quién puede destruir una versión:** nadie a solas. Se destruye después del punto 6 de arriba
  y con el visto bueno escrito de la dirección de la central.
- **Si se pierde la llave y no hay versión anterior:** los códigos de entrega cifrados **no se
  recuperan**. No hay puerta trasera y eso es a propósito. El plan de continuidad es el de papel
  (punto «Si el check-in de RocaKids falla un domingo») mientras se emiten códigos nuevos: los
  datos que cuentan (quién es el acudiente de quién) están en claro y no se pierden.
- **Copias:** las copias de `respaldar.sh` se cifran con `CASAROCA_LLAVE_RESPALDO`, que es
  **otra** llave. Guardar las dos en el mismo sitio anula el propósito de tener dos.

**Toda credencial recibida de un tercero se rota el mismo día.** Sin excepción.

## 5 · Agregar una sede

Nunca a mano. Desde la consola de sistemas o por API:
1. Se elige la **plantilla** según el tipo de sede: define con qué módulos y qué roles nace.
2. La sede nace colgada de su **región** (`org.sedes.unidad_id`).
3. Los módulos con compuerta legal (Aportes, RocaKids) **no se encienden sin evidencia legal registrada**: la base lo rechaza.
4. Se siembran sus salas de RocaKids y sus fondos.
5. Todo queda en `sistema.bitacora_aprovisionamiento`, que no se puede alterar.

## 6 · Dar de alta a alguien

```bash
node scripts/crear-cuenta.js "<documento o nombre>" <usuario> "<contraseña larga>"
```
- La contraseña es **temporal**: el sistema exige cambiarla al entrar.
- Si el rol alcanza datos **N3 o N4**, el segundo factor es **obligatorio**: al entrar recibe un token limitado que solo sirve para configurarlo.
- El acceso **cae solo** cuando termina el contrato o el voluntariado, y cuando la persona pasa a fallecida, inactiva o fusionada.

## 7 · Quitarle el acceso a alguien, ahora

```sql
-- Sacarlo de un equipo: corta en el instante lo heredado
SELECT org.sacar_del_equipo(<unidad>, <persona>, 'motivo escrito');

-- Revocar un permiso personal
SELECT identidad.revocar_asignacion(<asignacion>, 'motivo escrito');

-- Suspender la cuenta y cerrar TODAS sus sesiones
SELECT identidad.suspender_cuenta(<persona>, 'motivo escrito');
```
**⛔ No use `UPDATE ... SET vigente_hasta`:** una fecha no puede decir «ahora» y el acceso seguiría vivo hasta mañana.

## 8 · Qué mirar cuando «va lento» o «no carga»

En este orden, sin saltarse pasos:

1. `GET /salud/detalle` · ¿responde? ¿qué dice `estado`?
2. ¿La base responde y en cuántos milisegundos? En `/salud/detalle` el campo es `base.ms`
   (`baseMs`, sin punto, es el del `/salud` corto, que NO consulta la base).
3. ¿Las particiones están en `BIEN`? Un `HUECO` o un `CRITICO` se arregla con
   `SELECT plataforma.asegurar_particiones(3);`
4. ¿`fugasDeLectura` es 0? Si no, hay una tabla legible sin política: **eso se atiende antes que el rendimiento**.
5. Logs de Cloud Run filtrando por el `X-Peticion-Id` que reportó el usuario.
6. `SELECT * FROM identidad.v_alertas_acceso;` · ¿alguien está probando contraseñas?

## 9 · Un año nuevo y el sistema deja de escribir

**Síntoma:** todo `INSERT` falla el 1 de enero.
**Causa:** no existe la partición del año.
**Arreglo inmediato:**
```sql
SELECT plataforma.asegurar_particiones(3);
SELECT * FROM plataforma.v_salud_particiones;   -- todo en BIEN
```
**Por qué no debería pasar nunca:** la tarea mensual lo hace sola, hay partición por defecto como red y el banco `particiones.sql` falla en la integración continua si el colchón baja de dos años.

## 10 · Guardia dominical

**El pico es el domingo de 9:00 a 11:00.** Fuera de esa ventana el sistema puede esperar; dentro, no.

| Cuándo | Quién responde | En cuánto |
|---|---|---|
| Domingo 7:00 a 13:00 | Guardia de turno del equipo de Sistemas de la central | 15 minutos |
| Resto de la semana | Mesa de ayuda | Siguiente día hábil |

> 🔴 **Pendiente que no depende del código: falta el NOMBRE.**
> «Guardia de turno» es un puesto, no una persona. A las 9:10 de un domingo, con la fila de
> RocaKids parada, nadie llama a un puesto. Antes de la primera misa con el sistema en vivo hay
> que llenar esto, con nombre, teléfono y suplente, y dejarlo aquí escrito:
>
> | Turno | Nombre | Teléfono | Suplente |
> |---|---|---|---|
> | Guardia dominical | _(por definir)_ | _(por definir)_ | _(por definir)_ |
> | Segunda persona que sabe operar el sistema | _(por definir)_ | _(por definir)_ | — |
>
> La segunda persona es la que quita el riesgo de que todo dependa de uno solo. Mientras esa
> casilla esté vacía, el sistema tiene un punto único de fallo que ninguna nube arregla.

**⛔ Ninguna ventana de mantenimiento cae en domingo.** Son dos, y no es lo mismo:

| Ventana | Cuándo | Quién la fija |
|---|---|---|
| Mantenimiento de Google (Cloud SQL y Memorystore) | **Martes 03:00 Bogotá** (08:00 UTC) | `infra/gcp/sql.tf` y `red_y_redis.tf`. No se negocia sobre la marcha: se cambia en Terraform. |
| Despliegues y trabajos nuestros (migraciones, recifrado, cargas) | **Martes o miércoles, 22:00 a 00:00 Bogotá** | El equipo. Se anuncia con 24 h. |

Si alguna vez hay que moverlas, se mueven **en Terraform**, no en este documento: lo que manda es
lo que está aplicado.

**Si el check-in de RocaKids falla un domingo:** se activa el procedimiento en papel de la sede (planilla con nombre del menor, acudiente y código manual), y se carga después. La entrega de un niño **nunca** se hace sin verificar al acudiente, con sistema o sin él.

## 11 · Incidente con datos personales

1. Contener: suspender las cuentas implicadas y cerrar sus sesiones (punto 7).
2. Medir: `SELECT * FROM plataforma.v_quien_vio ...` y `identidad.intentos_acceso`.
3. Registrar el incidente con hora, alcance y datos afectados.
4. **Evaluar la notificación a la autoridad** (en Colombia, la SIC) y al titular. El plazo corre desde que se conoce.
5. Comunicar a la mesa. No se comunica a las sedes sin acuerdo de la mesa.
6. Postmortem escrito en `docs/DECISIONES/`, sin buscar culpables y con la corrección de la CAUSA, no del síntoma.

## 12 · Peticiones de Habeas Data

```sql
SELECT * FROM plataforma.v_peticiones_titular_vencidas;
```
**Una sola fila aquí es un incumplimiento de la Ley 1581, no un pendiente.** Consulta: 10 días hábiles. Reclamo: 15. Los plazos los calcula la base al radicar.

## 13 · Lo que NO se hace nunca

- Conectarse a la base como propietario o superusuario desde la aplicación: la seguridad por fila no se aplica al dueño y se anularía sin un solo aviso.
- Restaurar una copia encima de la base viva «para probar».
- Desplegar sin `verificar.sh` en verde.
- Poner un secreto en el repositorio, en un mensaje o en un correo.
- Dar acceso «temporal» sin fecha de fin.
- Desplegar un domingo.
