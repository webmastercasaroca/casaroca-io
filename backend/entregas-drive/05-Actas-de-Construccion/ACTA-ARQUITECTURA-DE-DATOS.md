# Acta de arquitectura de datos · qué está conectado y qué falta

| Campo | Dato |
|---|---|
| Proyecto | CasaRoca System · Sistema 100p |
| Componente | Base de datos y sincronización de los paneles |
| Fecha de corte | 15 de septiembre de 2026 |
| Repositorio | `github.com/100p-NANO/ecosistema-cr` |
| Estado medido | 39 migraciones · 70 tablas · 9 pruebas en verde |

---

## 1. Objeto de este documento

Responder con números a una pregunta concreta: **¿está todo conectado?** No con una opinión,
sino midiendo la base contra lo que el Documento 4 (`04-Mapa-Datos-Solicitados`) dejó postulado.

La respuesta corta es: **la columna vertebral ya está conectada, y falta la mitad del volumen.**
Lo que sigue dice exactamente qué mitad.

## 2. La forma del modelo

Todo cuelga de la persona, y todo se cuenta en una sola línea de tiempo.

```
nucleo.personas ─────────── el centro
      │
      ├─ identidad.asignaciones ── rol × alcance × techo × vigencia
      ├─ org.sedes / ministerios / ministerios_sede
      │
      └─ crm.linea_tiempo ──────── LA ESPINA
                ▲                  un hecho por fila, venga de donde venga
     ┌──────────┴──────────┬───────────┬────────────┐
  aportes   asistencia   grupos   consejería   formación
```

**Un módulo nuevo se conecta con dos llamadas:** registra su tipo en `crm.tipos_hecho` y llama a
`crm.anotar_hecho()`. Desde ese momento su información aparece sola en la ficha de la persona,
sin tocar el núcleo. Esa es la respuesta técnica a *«si mañana creo un módulo, que arrastre la
información»*.

## 3. 🔴 El hallazgo que obligó a esta revisión

**Doce de los trece tipos de hecho estaban en cero.** Había ocho aportes registrados y ninguno
aparecía en la línea de tiempo de nadie. Los doce disparadores que existían sobre las tablas de
los módulos eran todos de integridad; **ninguno alimentaba el CRM**.

La decisión de arquitectura estaba bien tomada y escrita. Estaba la tabla, estaban los trece
tipos. Faltaba lo único que la hace cierta: que los módulos escribieran.

Corregido en la migración `0036`. Comprobado: `APORTE` pasó de 0 a 8 filas **solo**, sin tocar
una línea de aplicación.

⛔ **Y una decisión de privacidad que va escrita en el código:** el hecho de un aporte **no lleva
el monto**. `APORTE` es N3 y la migración `0034` subió al Pastor Congregacional a N4, así que él
lee esos hechos; y la regla dice que él ve *si* una familia aporta, nunca cuánto. Si el monto
fuera en el resumen, la línea de tiempo sería la puerta trasera de esa regla.

## 4. Lo construido frente a lo postulado

| Dominio | Postuladas | Construidas | Falta |
|---|---|---|---|
| Núcleo · persona | 14 | 6 | −8 |
| 01 Organización | 9 | 5 | −4 |
| 02 Identidad y acceso | 11 | 2 | **−9** |
| 03 Grupos | 8 | 5 | −3 |
| 04 CRM Pastoral | 12 | 7 | −5 |
| 05 Asistencia | 7 | 3 | −4 |
| 06 RocaKids | 9 | 6 | −3 |
| 07 Consejería | 6 | 5 | −1 |
| 08 Aportes | 11 | **8** | −3 |
| 09 Formación | 10 | 5 | −5 |
| 10 Talento | 12 | 3 | **−9** |
| 11 Línea de tiempo | 4 | 4 | ✅ |
| Plataforma y sistema | 13 | 15 | ✅ |
| **Total** | **126** | **70** | **−56** |

Las dos brechas grandes son **Identidad y acceso** (sesiones, dispositivos, tokens) y
**Talento** (HCM completo). Ninguna de las dos bloquea hoy: la primera porque la identidad real
la resolverá Keycloak, la segunda porque el HCM aún no arranca.

## 5. El diezmo en línea, funcionando

Migración `0038`. La transacción es el **intento**; el aporte es el **hecho**. Escribir en
`aportes.aportes` al iniciar un pago sería contabilizar dinero que no llegó, y un pago rechazado
no tendría dónde vivir.

Probado de punta a punta sobre la base real:

| Paso | Resultado |
|---|---|
| Contabilizar un pago **sin aprobar** | Negado |
| La pasarela aprueba | Aporte contable creado |
| Queda pegado a la persona | Sí, emparejado por documento |
| Aparece en su línea de tiempo | Sí, **sin el monto** |
| El webhook llega **dos veces** | Un solo aporte |

⭐ Sin dueño **no se contabiliza a nombre de nadie ni se inventa un anónimo**: queda en
`v_pagos_sin_dueno`, que se mira todos los días. Un diezmo mal atribuido es peor que uno sin
atribuir, porque el certificado tributario saldría a nombre equivocado.

## 6. Casillas nuevas sin migración

Migración `0037`. Añadir una casilla dejó de ser una migración y pasó a ser una llamada:

```sql
SELECT sistema.crear_atributo('comida_favorita', 'Qué le gusta comer',
       'personas', 'texto', 2);
```

⛔ **Cada casilla declara su nivel**, y la privacidad sale sola de ahí. Una casilla de alergias
nace N3 aunque quien la creó no supiera que estaba creando un dato de salud. Sin esa regla, la
tabla de campos extra se convierte en el cajón donde acaba el dato sensible sin etiqueta.

## 7. ⛔ El fallo que apareció tres veces el mismo día

| Catálogo | Estaba | Consecuencia |
|---|---|---|
| `org.ministerios` | 2 de 27 | El panel de cualquier pastor salía **vacío** |
| `aportes.fondos` | **0 filas** | **No se podía registrar ni un aporte** |
| `talento.cargos` | **0 filas** | No se podía registrar un contrato |

Las tres tablas estaban bien diseñadas. Vacías. Y es un fallo **silencioso**: la migración pasa,
los permisos pasan, el despliegue sale verde, y la aplicación simplemente no deja hacer nada.

Sembrados los tres, y convertido en prueba automática: `catalogos_no_vacios.sql` recorre toda la
base buscando tablas referenciadas por una columna `NOT NULL` y falla si alguna está vacía.
**No habrá un cuarto caso.**

## 8. La sincronización de los paneles

Antes: **ocho islas de datos** sin nada en común. Medido: «Andrés Lozano» existía en **cinco**
archivos distintos, cada uno con su propio identificador.

| Qué | Antes | Ahora |
|---|---|---|
| Paneles que consultan el centro de mando | 1 de 10 | **10 de 10** |
| Paneles con identidad conectada | 4 de 10 | **10 de 10** |
| Orden de carga | el cerebro **al final** | el cerebro primero |
| Recursos con sello de caché | 17 de 54 | **62 de 62** |

⛔ **Dos tercios del código nunca llegaba al navegador.** El procedimiento de sellado solo
refrescaba sellos existentes, así que 37 archivos sin sello se cacheaban para siempre: se
editaban, se desplegaban, y quien ya había entrado seguía viendo la versión vieja.

⛔ **Y el despliegue tampoco llegaba al dato.** El censo vive en el navegador y nunca se
refrescaba: el catálogo pasó de 2 a 27 ministerios, se desplegó bien, y producción seguía
mostrando 2. Ahora hay versión de catálogo, y se refresca **el catálogo, no el trabajo de la
gente**: lo que la iglesia creó se respeta.

## 9. Lo que sigue, en orden

| | Qué | Por qué |
|---|---|---|
| 1 | La **API** que una los paneles con esta base | Es lo único que falta para que todo lo anterior se vea. Hoy cubre un módulo de trece |
| 2 | `talento` y `oracion` a la línea de tiempo | Media hora, y la ficha 360 queda completa salvo menores |
| 3 | RLS propia en las particiones de la línea | Hoy las protege un permiso, no una política |
| 4 | RocaKids a la línea de tiempo | **Decisión de la iglesia, no de programación**: son hechos N4 sobre menores |

---

*Documento de la mesa de trabajo del Sistema 100p. Todas las cifras están medidas contra la base
en ejecución, no estimadas.*
