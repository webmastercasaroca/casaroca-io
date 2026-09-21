# Lo del Drive «Sistema 100p», ya en el sistema

**18 de septiembre de 2026.** Se leyeron en vivo los documentos de la carpeta y cada renglón
quedó construido y probado en `100p-NANO/ecosistema-cr`.

| Documento del Drive | Qué quedó en el sistema |
|---|---|
| Usuarios (Personas) v1.2 | Los campos que faltaban (`nombre_corto`, `nacionalidad`, país, ciudad y zona de residencia, `email_secundario`, `telefono_emergencia`, `es_cristiano`, `iglesia_anterior`, `es_ministro`, directorio público). La tabla `personas` con sus nombres exactos en `modelo100p.personas`. |
| Roles v1.0 | Los 9 roles iniciales y los de las fases 3 a 5 (PROPIETARIO, DIGITADOR_APORTES, ASISTENCIA_REGISTRO, VISITANTE, LIDER_DE_ORACION, PERSONA_QUE_ORA, GERENCIA_ADMINISTRATIVA, AUDITOR), todos sus permisos por nombre, `roles.activo`, y `usuario_roles`, `permisos_por_rol` y `auditoria_roles` con sus nombres. |
| Nuevos v1.0 | Las 5 rutas con sus cuerpos, coordinador asignado por sede, contacto a las 24 h, notas privadas del coordinador, conversión con grupo y padrino, reCAPTCHA, correos de bienvenida, aviso al coordinador y confirmación, y las 4 tablas del documento. |
| Donaciones v1.0 | Registro manual, aprobación (quien digita no aprueba), consulta de Tesorería, certificado numerado e imprimible, anulación con motivo, DONACION y CONSIGNACION, confirmación por correo del pago en línea, y las 3 tablas del documento. |
| Arquitectura Frontend | `frontend/src/styles` con la estructura exacta (variables, base y los 5 módulos), con la paleta institucional y Geomanist. |
| Plan de costos GCP | `infra/gcp/`: Terraform por fase (0, 1 y 2), Cloud Run, Cloud SQL, Secret Manager, Storage, KMS, Redis y Cloud Armor desde la fase 1, y Cloud Build. Nada aplicado todavía. |

**Lo que el sistema NO copió tal cual, y por qué** (se publica con el nombre del Drive, pero el
dato se deriva):
- `permite_whatsapp` y `consentimiento_gdpr` salen de la tabla de consentimientos (Ley 1581): un
  booleano suelto seguiría diciendo «sí» después de que la persona lo revocó.
- El correo sigue siendo opcional: exigirlo deja por fuera a menores y adultos mayores.
- Los niveles de sensibilidad no cambian: los aportes siguen en N3. Con N2 como financiero, un
  rol N2 vería los diezmos.

**Hallazgo corregido de paso:** una sesión N2 podía leer los certificados de donación de su sede
(con el total anual de cada persona). Ahora exige N3, igual que los aportes.
