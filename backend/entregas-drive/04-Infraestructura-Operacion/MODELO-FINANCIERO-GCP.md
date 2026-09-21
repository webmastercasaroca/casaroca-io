# Modelo financiero recalculado sobre GCP

**Para:** equipo Sistema 100p Casa Roca Global · Dirección de Tecnología y Dirección Financiera
**Reemplaza a:** la tabla de costo recurrente del Documento 2, escenario A
**Motivo:** el Documento 2 dimensionó sobre AWS (Fargate, RDS). El equipo va con
GCP —Cloud Run, Cloud SQL, Terraform—, y esa decisión es razonable: el diseño del
Documento 1 se hizo portable a propósito. Lo que no es portable son los precios.

---

## El resultado, primero

| | Documento 2 (AWS) | Recalculado (GCP) | Diferencia |
|---|---|---|---|
| Producción | 349 USD/mes | **488 USD/mes** | +139 |
| Preproducción | 22 USD/mes | **18 USD/mes** | −4 |
| **Total** | **371 USD/mes** | **506 USD/mes** | **+135 (+36 %)** |
| **En pesos** (4.050 COP/USD) | **1.502.550** | **2.049.300** | **+546.750** |

**La conclusión no cambia la recomendación: la confirma.** El Documento 2 pedía
presupuestar 2.000.000 COP/mes y no 1,5 M, dejando 500.000 de colchón. En GCP ese
colchón deja de serlo: **se convierte en el presupuesto base**. Se sigue
presupuestando lo mismo; lo que cambia es que ya no sobra.

Y frente a lo que importa, la comparación no se mueve: la plataforma actual cuesta
**9.500.000 COP/mes**. Pasar de 1,5 a 2,05 millones no altera el sentido de la
decisión — sigue siendo una quinta parte del gasto de hoy.

---

## Método

Se tomó **la misma tabla del Documento 2, línea por línea**, sin cambiar el
dimensionamiento: 36 sedes, 25.000 personas, pico de 120 peticiones por segundo,
los mismos 14 pilares de arquitectura. Solo se sustituyó cada servicio de AWS por
su equivalente en GCP y se aplicó el precio de lista publicado.

No se recortó nada de seguridad, igual que en el original.

⚠️ **Los precios son de lista, región `us-east1`, consultados en agosto de 2026.**
Antes de llevar este modelo a comité conviene reproducirlo en el calculador de
GCP: los precios de nube cambian, y una cifra que nadie verificó no se debe
defender en una mesa.

---

## Tabla recalculada · escenario A

| Componente | Servicio GCP | USD/mes | vs AWS |
|---|---|---|---|
| PostgreSQL gestionado · 2 vCPU · 4 GB · HA · 100 GB | Cloud SQL Enterprise, regional | **204** | +84 |
| Contenedores de API · 2 × (0,5 vCPU · 1 GB) | Cloud Run, 1 instancia mínima + demanda | **55** | +19 |
| Trabajadores · colas y tareas nocturnas | Cloud Run | **14** | +5 |
| Keycloak · 2 × (0,5 vCPU · 1 GB) | Cloud Run | **58** | +22 |
| Balanceador de carga + certificados | Cloud Load Balancing | **20** | −5 |
| Salida controlada a internet | Instancia `e2-micro` como NAT | **7** | +3 |
| Redis · caché, colas y límite de tasa | Memorystore Basic 1 GB | **36** | +24 |
| Almacenamiento de objetos · 250 GB | Cloud Storage Standard | **6** | −2 |
| Red de distribución · 100 GB de salida | Cloud CDN | **9** | −1 |
| Gestión de llaves | Cloud KMS | **3** | −3 |
| Gestor de secretos | Secret Manager | **5** | −3 |
| Registro y métricas · retención 30 días | Cloud Logging + Monitoring | **13** | +1 |
| Cortafuegos de aplicación · OWASP + anti-bot | Cloud Armor Standard | **26** | −1 |
| Correo transaccional · 150.000 envíos | *(ver nota)* | **15** | 0 |
| Registro de imágenes | Artifact Registry | **2** | −1 |
| Respaldos + bóveda inmutable · PITR 35 días | Cloud SQL PITR + bucket con retención | **15** | −3 |
| **Subtotal producción** | | **488** | **+139** |
| Preproducción · se enciende ~40 h/semana | Cloud Run escala a cero de forma nativa | **18** | −4 |
| **TOTAL** | | **506** | **+135** |

---

## Las tres líneas que explican TODO el aumento

De los +135 USD, **145 vienen de tres partidas**. El resto del catálogo, sumado, es
ligeramente más barato en GCP que en AWS.

### 1. Cloud SQL · +84 USD — la más grande y la menos evitable
AWS tiene instancias *burstables* (`t4g.medium`): 2 vCPU y 4 GB por unos 47 USD, y
en alta disponibilidad ~120. **Cloud SQL no tiene tipo burstable para producción.**
Se paga vCPU y memoria a tarifa plena, y la alta disponibilidad regional duplica
ambas. No es un error de dimensionamiento: es la diferencia entre los dos catálogos.

### 2. Keycloak y la API en Cloud Run · +41 USD combinados
Cloud Run cobra por segundo de vCPU asignada. Con instancias mínimas encendidas
—que hacen falta: un domingo a las 9:00 nadie puede esperar un arranque en frío—
sale más caro que Fargate al mismo tamaño.

⚠️ **Nota técnica sobre Keycloak:** funciona en Cloud Run, pero su caché de sesiones
(Infinispan) asume nodos que se ven entre sí. En Cloud Run hay que configurarlo en
modo de base de datos o aceptar sesiones no compartidas entre instancias. Es una
decisión de configuración que conviene tomar antes de desplegar, no después del
primer domingo con dos instancias activas.

### 3. Memorystore Redis · +24 USD
La instancia más pequeña de Memorystore cuesta unas tres veces lo que un
`cache.t4g.micro` de AWS. Es el precio de entrada del servicio: no hay un escalón
más bajo.

---

## Nota sobre el correo transaccional

Es la única partida donde **GCP no tiene un servicio propio equivalente**. AWS lo
resolvía con SES a 15 USD por 150.000 envíos; el proveedor externo más común
(SendGrid) cuesta entre 4 y 6 veces eso para ese volumen.

**Recomendación:** mantener SES aunque el resto viva en GCP. Enviar correo desde un
proveedor distinto al de la infraestructura es una práctica corriente y no crea
acoplamiento: el sistema habla con una API de correo, no con una nube. Si la
organización prefiere no abrir cuenta en AWS, las alternativas razonables por
volumen son Brevo o Mailjet — no SendGrid, que en este tramo es el más caro.

---

## Cómo bajar de 2 millones, si hace falta

| Palanca | Ahorro | Cuándo |
|---|---|---|
| Compromiso de uso a 1 año en Cloud SQL y Cloud Run | ~−50 USD/mes | Después de tres meses estables, no antes |
| Trabajadores como Cloud Run Jobs en vez de servicio encendido | −14 USD/mes | Desde el inicio; la tarea nocturna no necesita estar viva todo el día |
| Sustituir Redis por Cloud Tasks para las colas | −36 USD/mes | Solo si se acepta perder la caché; añade complejidad |

Aplicando las dos primeras —las que no cuestan nada en diseño— el total baja a
**~442 USD/mes ≈ 1.790.000 COP**. Sigue por encima del objetivo original de 1,5 M,
y sigue dentro del presupuesto de 2 M que ya estaba recomendado.

---

## Región: la decisión que más mueve la cifra

Todo lo anterior está calculado en **`us-east1`**. Si la residencia de datos exige
mantenerlos en Suramérica, `southamerica-east1` (São Paulo) cuesta entre **25 % y
30 % más** en cómputo y base de datos:

| Región | USD/mes | COP/mes |
|---|---|---|
| `us-east1` | 506 | 2.049.300 |
| `southamerica-east1` (São Paulo) | ~648 | ~2.624.400 |

⚠️ **GCP no tiene región en Colombia.** La decisión de residencia quedó cerrada en
el Documento 1 y hay que releerla antes de elegir: si exige territorio nacional,
ninguna de las dos opciones la cumple y habría que revisar la cláusula, no la
región. Si admite tratamiento en el exterior con las garantías de la Ley 1581
—que es lo habitual—, `us-east1` es la opción correcta por precio y por latencia
(unos 70 ms a Bogotá, similar a São Paulo).

Esta única decisión vale **575.000 COP/mes**. Conviene tomarla explícitamente y
dejarla escrita, no heredarla del valor por defecto de una consola.

---

## Sensibilidad a la tasa de cambio

El Documento 2 usó 4.050 COP/USD. Con el nuevo total de 506 USD:

| Tasa | COP/mes |
|---|---|
| 3.850 | 1.948.100 |
| **4.050** | **2.049.300** |
| 4.250 | 2.150.500 |
| 4.500 | 2.277.000 |

Una variación de ±10 % en la tasa mueve el costo ±205.000 COP/mes — antes eran
±150.000. El presupuesto de 2 M absorbe hasta ~3.950 COP/USD sin holgura; por
encima de eso conviene tener el compromiso de uso ya firmado.

---

## Lo que NO cambia del Documento 2

- La inversión única (26,9 M COP: intrusión, legal, capacitación) es independiente
  de la nube.
- El motor de IA (5,84 M por seis meses) se cotiza por millón de tokens, no por
  proveedor de infraestructura.
- Los tres escenarios A / B / C y sus gatillos siguen siendo válidos: lo que cambia
  es el punto de partida de cada uno.
- La disciplina de gobierno del gasto sigue igual, y vale la pena repetirla:
  **ningún componente nuevo se enciende si no aparece en esta tabla con su costo.**

---

## Lo que hay que verificar antes de llevarlo a comité

1. Reproducir la tabla en el calculador de GCP con la región elegida.
2. Confirmar la cláusula de residencia del Documento 1.
3. Decidir el proveedor de correo transaccional.
4. Confirmar si Cloud SQL Enterprise Plus cambia el cálculo — tiene mejor
   rendimiento por vCPU y podría permitir bajar de 2 vCPU a un tamaño menor con la
   misma capacidad efectiva. No se modeló aquí porque exige medir, no estimar.
