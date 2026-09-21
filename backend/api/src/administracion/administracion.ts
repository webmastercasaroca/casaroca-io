import { BadRequestException, Body, Controller, ForbiddenException, Get, Module,
         NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { randomInt } from 'node:crypto';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { uuid, texto, textoOpcional, booleano, entero } from '../comun/validar';
import { derivarClave } from '../auth/clave';

/**
 * Administración de la solución.
 *
 * ⛔ 20 de septiembre de 2026. Hasta hoy esto NO EXISTÍA. El primer Pastor
 * Director General se creaba con un comando en la terminal y los roles de
 * las 36 sedes se otorgaban por SQL o con `curl`. Para una red de 36
 * iglesias eso no es operable: significa que una sola persona, con acceso
 * a un portátil, es la única que puede dar de alta a alguien.
 *
 * ⛔ Y antes de exponer nada se cerró un hueco: `identidad.crear_cuenta`
 * era SECURITY DEFINER y no comprobaba quién llamaba. No era explotable
 * porque ninguna ruta la exponía; la primera ruta de administración la
 * habría convertido en «cualquier sesión crea una cuenta con N4 sobre
 * toda la red». La comprobación vive ahora DENTRO (migración 0059), que es
 * donde no se puede olvidar.
 *
 * Aquí no hay ni una regla de permiso: todas las funciones que se llaman
 * exigen por dentro administrar `identidad` Y que la persona afectada esté
 * en el alcance de quien llama.
 */

/** Contraseña provisional legible por teléfono: cuatro palabras y un número.
    ⛔ No se inventan «claves seguras» impronunciables: la persona que la
    recibe la va a copiar a mano de un papel o de un mensaje, y una clave
    que se copia mal se acaba escribiendo en una nota pegada al monitor. */
const PALABRAS = [
  'ancla','brisa','cedro','duna','enero','faro','grano','hilo','isla','jarra',
  'lazo','monte','nido','ola','pino','quila','rama','sauce','trigo','uva',
  'valle','yunque','zorro','barro','cielo','dedal','espiga','fuente',
];
function claveProvisional(): string {
  const p = Array.from({ length: 4 }, () => PALABRAS[randomInt(PALABRAS.length)]);
  return `${p.join(' ')} ${randomInt(10, 100)}`;
}

/**
 * Traduce lo que la base ya explicó.
 *
 * ⛔ 20 de septiembre de 2026. Cada una de las doce rutas de este archivo
 * tenía SU PROPIA lista de códigos de error, y cada lista era distinta.
 * Desplegar una iglesia con una plantilla mal escrita devolvía «Ocurrió
 * un error inesperado. Reporte este código al soporte» porque `P0002` no
 * estaba en la lista de ESA ruta, mientras la base ya había dicho, en
 * español y con el nombre del dato: «La plantilla PLANTA no existe o no
 * tiene módulos». El operador veía un código de incidencia; la respuesta
 * estaba a un `catch` de distancia.
 *
 * Las reglas del negocio viven en la base (funciones con RAISE,
 * restricciones, disparadores) justo para que no se puedan saltar. Si
 * esos mensajes se pierden al subir, el sistema queda mudo. Esto los
 * sube TODOS, en un solo sitio, para que ninguna ruta pueda olvidarse de
 * uno.
 */
function traducir(e: any, propios: Record<string, string> = {}): never {
  const codigo = String(e?.code ?? '');
  if (propios[codigo]) throw new BadRequestException(propios[codigo]);

  /* Lo que se negó a propósito: no es un fallo, es la regla funcionando. */
  if (codigo === '42501') throw new ForbiddenException(limpiar(e.message));

  const delNegocio = [
    'P0001',  // RAISE EXCEPTION nuestro
    'P0002',  // no encontrado, lanzado por una función nuestra
    '02000',  // sin datos
    '23514',  // restricción CHECK
    '23505',  // repetido
    '23503',  // apunta a algo que no existe
    '23502',  // falta un dato obligatorio en la tabla
    '22P02',  // un valor con una forma que la columna no acepta
    '22003',  // fuera de rango
    '23P01',  // se cruza con otro periodo
  ];
  if (delNegocio.includes(codigo)) throw new BadRequestException(limpiar(e.message));
  throw e;
}

/** El mensaje que ve un operador, sin la jerga del motor. */
function limpiar(mensaje: string): string {
  return String(mensaje ?? '')
    .replace(/^new row for relation "[^"]+" violates check constraint "([^"]+)"$/,
             'Ese dato no cumple la regla «$1» del sistema.')
    .replace(/^duplicate key value violates unique constraint "[^"]+"$/,
             'Ya existe un registro con ese mismo valor.')
    .trim() || 'La operación no se pudo completar.';
}

@Controller('api/v1/administracion')
export class AdministracionController {
  constructor(private readonly db: DbService) {}

  /** Las cuentas que uno alcanza, con lo que hace falta para atenderlas. */
  @Get('cuentas')
  cuentas(@Req() req: Request, @Query('q') q?: string, @Query('limite') limite?: string) {
    exigirNivel(req, 4, 'administrar cuentas');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT * FROM identidad.listar_cuentas($1,$2)`,
        [textoOpcional(q, 'q', { max: 80 }),
         limite ? entero(limite, 'limite', { min: 1, max: 500 }) : 100]);
      const problemas = rows.filter(r => r.bloqueada || r.estado !== 'activa'
        || (r.exige_segundo_factor && !r.segundo_factor_activo));
      return {
        total_filas: rows.length, cuentas: rows,
        aviso: problemas.length
          ? `${problemas.length} cuenta(s) necesitan atención: bloqueadas, suspendidas o con el segundo factor sin activar.`
          : null,
      };
    });
  }

  /**
   * Crear una cuenta. Devuelve la contraseña provisional UNA VEZ.
   * ⛔ No se guarda en ninguna parte legible ni se vuelve a mostrar: si se
   * pierde, se reinicia. Enviarla por correo desde el sistema sería peor:
   * quedaría en un buzón para siempre.
   */
  @Post('cuentas')
  crear(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'crear una cuenta');
    return conSesion(this.db, req, async (c) => {
      const clave = claveProvisional();
      try {
        const { rows: [r] } = await c.query(
          `SELECT identidad.crear_cuenta($1,$2,$3) AS id`,
          [uuid(b?.personaId, 'personaId'),
           texto(b?.usuario, 'usuario', { min: 5, max: 120 }),
           derivarClave(clave)]);
        return {
          id: r.id, usuario: b.usuario, clave_provisional: clave,
          mensaje: 'Cuenta creada. Entregue esta contraseña en persona o por un canal seguro: '
                 + 'no se vuelve a mostrar y el sistema obligará a cambiarla al entrar.',
        };
      } catch (e: any) {
        traducir(e, {
          '23505': 'Ya existe una cuenta con ese usuario, o esa persona ya tiene cuenta.',
          '23503': 'Esa persona no existe.',
        });
        throw e;
      }
    });
  }

  @Post('cuentas/:id/reiniciar-clave')
  reiniciarClave(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 4, 'reiniciar una contraseña');
    return conSesion(this.db, req, async (c) => {
      const clave = claveProvisional();
      await c.query(`SELECT identidad.reiniciar_clave($1,$2)`, [uuid(id, 'id'), derivarClave(clave)]);
      return {
        clave_provisional: clave,
        mensaje: 'Contraseña reiniciada y TODAS sus sesiones cerradas. '
               + 'Entréguela por un canal seguro: no se vuelve a mostrar.',
      };
    });
  }

  @Post('cuentas/:id/desbloquear')
  desbloquear(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 4, 'desbloquear una cuenta');
    return conSesion(this.db, req, async (c) => {
      await c.query(`SELECT identidad.desbloquear($1)`, [uuid(id, 'id')]);
      return { mensaje: 'Cuenta desbloqueada.' };
    });
  }

  @Post('cuentas/:id/reiniciar-segundo-factor')
  reiniciarMfa(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 4, 'reiniciar el segundo factor');
    return conSesion(this.db, req, async (c) => {
      await c.query(`SELECT identidad.reiniciar_segundo_factor($1)`, [uuid(id, 'id')]);
      return {
        mensaje: 'Segundo factor reiniciado y sesiones cerradas. La persona lo volverá a configurar '
               + 'al entrar. NO se le quitó la exigencia: su rol lo sigue necesitando.',
      };
    });
  }

  /** Quién está dentro ahora mismo. */
  @Get('sesiones')
  sesiones(@Req() req: Request) {
    exigirNivel(req, 4, 'ver las sesiones abiertas');
    return conSesion(this.db, req, async (c) => {
      /* ⛔ Por función, no por SELECT directo: `identidad.sesiones` está
         cerrada a la aplicación y tiene que seguir estándolo. */
      const { rows } = await c.query(`SELECT * FROM identidad.ver_sesiones_activas(200)`);
      return { total_filas: rows.length, sesiones: rows };
    });
  }

  /** Quién está probando contraseñas. */
  @Get('alertas')
  alertas(@Req() req: Request) {
    exigirNivel(req, 4, 'ver las alertas de acceso');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(`SELECT * FROM identidad.ver_alertas_acceso(100)`);
      return {
        total_filas: rows.length, alertas: rows,
        aviso: rows.length ? `${rows.length} usuario(s) o dirección(es) con intentos fallidos agrupados.` : null,
      };
    });
  }

  /** Accesos que llevan demasiado sin revisarse. */
  /**
   * La lista de trabajo del comité trimestral.
   *
   * ⛔ 20 de septiembre de 2026. Esto devolvía TODOS los accesos vigentes
   * de la red y la consola los pintaba bajo la etiqueta «Por
   * recertificar», mientras este mismo aviso afirmaba que «llevan más del
   * plazo sin revisarse». Un acceso otorgado esta mañana ya contaba. En
   * la base había 17; los vencidos de verdad eran 0. Es exactamente la
   * cifra que un auditor contrasta en treinta segundos.
   */
  @Get('recertificar')
  recertificar(@Req() req: Request, @Query('todos') todos?: string) {
    exigirNivel(req, 4, 'ver los accesos por recertificar');
    return conSesion(this.db, req, async (c) => {
      const { rows: [n] } = await c.query(
        `SELECT count(*) FILTER (WHERE vencido) AS vencidos, count(*) AS vigentes
           FROM identidad.v_accesos_por_recertificar`);
      const { rows } = await c.query(
        `SELECT * FROM identidad.v_accesos_por_recertificar
          ${todos === 'si' ? '' : 'WHERE vencido'}
          ORDER BY vencido DESC, dias_sin_revisar DESC LIMIT 200`);
      return {
        total_filas: rows.length, accesos: rows,
        vencidos: Number(n.vencidos), vigentes: Number(n.vigentes),
        aviso: Number(n.vencidos)
          ? `${n.vencidos} acceso(s) pasaron su plazo de revisión, de ${n.vigentes} vigentes. Un permiso que nadie revisa es un permiso que nadie quitó.`
          : `Ninguno de los ${n.vigentes} accesos vigentes pasó su plazo. El plazo es de 90 días para los que tocan datos N3 o N4, y de 180 para el resto.`,
      };
    });
  }

  /**
   * Recertificar un acceso: la puerta que NO EXISTÍA.
   *
   * ⛔ `identidad.recertificaciones` estaba creada desde la migración 0045
   * y nadie escribía en ella. La pantalla del comité era una lista que no
   * se podía tachar: `dias_sin_revisar` solo podía crecer.
   */
  @Post('recertificar/:asignacionId')
  recertificarUno(@Req() req: Request, @Param('asignacionId') id: string, @Body() b: any) {
    exigirNivel(req, 4, 'recertificar un acceso');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [r] } = await c.query(
          `SELECT identidad.recertificar($1, $2, $3) AS hecho`,
          [uuid(id, 'asignacionId'),
           texto(b?.veredicto, 'veredicto', { min: 8, max: 12 }),
           texto(b?.nota, 'nota', { min: 5, max: 400 })]);
        return { ...r.hecho, mensaje: b?.veredicto === 'se_revoca'
          ? 'Revisado y REVOCADO. La persona pierde ese acceso ahora mismo.'
          : 'Revisado. El contador de días vuelve a cero y queda firmado con su nombre.' };
      } catch (e: any) { traducir(e); }
    });
  }

  /**
   * Cerrarle la sesión a alguien.
   *
   * ⛔ «Sesiones y alertas» era de SOLO LECTURA: se veía quién estaba
   * dentro y no había forma de echarlo. Si alguien pierde el teléfono un
   * domingo, esto es lo que hay que poder hacer sin entrar a la base.
   */
  @Post('sesiones/:id/cerrar')
  cerrarSesion(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 4, 'cerrar la sesión de otra persona');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [r] } = await c.query(
          `SELECT identidad.cerrar_sesion_de_otro($1, $2) AS hecho`,
          [uuid(id, 'id'), texto(b?.motivo, 'motivo', { min: 5, max: 300 })]);
        return { ...r.hecho, mensaje: 'Sesión cerrada. Surte efecto ahora, no cuando expire el token.' };
      } catch (e: any) { traducir(e); }
    });
  }

  /** El organigrama: central, regiones, direcciones y equipos. */
  @Get('organigrama')
  organigrama(@Req() req: Request) {
    exigirNivel(req, 2, 'ver el organigrama');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT * FROM org.v_organigrama ORDER BY ruta`);
      return { total_filas: rows.length, unidades: rows };
    });
  }

  /** Los módulos de una sede y cuáles están encendidos. */
  @Get('sedes/:id/modulos')
  modulosDeSede(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 3, 'ver los módulos de una sede');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT m.codigo, m.nombre, m.nivel_dato, m.es_nucleo, m.exige_compuerta_legal, m.depende_de,
                COALESCE(ms.activo, false) AS activo, ms.evidencia_legal_ref, ms.activado_en, ms.nota
           FROM sistema.modulos m
           LEFT JOIN sistema.modulos_sede ms ON ms.modulo = m.codigo AND ms.sede_id = $1
          ORDER BY m.es_nucleo DESC, m.nombre`, [uuid(id, 'id')]);
      const faltaEvidencia = rows.filter(r => r.activo && r.exige_compuerta_legal && !r.evidencia_legal_ref);
      return {
        total_filas: rows.length, modulos: rows,
        aviso: faltaEvidencia.length
          ? `${faltaEvidencia.length} módulo(s) encendidos con compuerta legal y sin la referencia del instrumento jurídico.`
          : null,
      };
    });
  }

  /** Encender o apagar un módulo en una sede. La base impone las reglas. */
  @Post('sedes/:id/modulos')
  habilitarModulo(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 4, 'encender o apagar un módulo');
    return conSesion(this.db, req, async (c) => {
      try {
        await c.query(
          `SELECT sistema.habilitar_modulo($1,$2,$3,$4,$5)`,
          [uuid(id, 'id'), texto(b?.modulo, 'modulo', { min: 2, max: 40 }),
           booleano(b?.activo, 'activo'),
           textoOpcional(b?.evidencia, 'evidencia', { max: 200 }),
           textoOpcional(b?.nota, 'nota', { max: 400 })]);
        return { mensaje: b.activo ? 'Módulo encendido en esa sede.' : 'Módulo apagado en esa sede.' };
      } catch (e: any) {
        traducir(e);
        throw e;
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     EL COMANDO CENTRAL
     ⛔ Esta es la razón de ser del módulo. El equipo de la central es
     quien despliega iglesias, personas, roles y módulos, y quien arma los
     equipos (contabilidad, tesorería, pastoral) que después administran lo
     suyo. Sin estas rutas, «administrar la red» era entrar a la base.
     ══════════════════════════════════════════════════════════════════ */

  /** Las plantillas: qué módulos trae una iglesia nueva según su tipo. */
  @Get('plantillas')
  plantillas(@Req() req: Request) {
    exigirNivel(req, 3, 'ver las plantillas de iglesia');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT p.codigo, p.nombre, p.tipo_sede, p.descripcion,
                count(pm.modulo)::int AS modulos,
                string_agg(m.nombre, ', ' ORDER BY m.orden) AS lista,
                count(*) FILTER (WHERE m.exige_compuerta_legal)::int AS con_compuerta_legal
           FROM sistema.plantillas p
           LEFT JOIN sistema.plantilla_modulos pm ON pm.plantilla = p.codigo
           LEFT JOIN sistema.modulos m ON m.codigo = pm.modulo
          GROUP BY p.codigo, p.nombre, p.tipo_sede, p.descripcion
          ORDER BY p.nombre`);
      return {
        total_filas: rows.length, plantillas: rows,
        aviso: 'Los módulos con compuerta legal nacen APAGADOS: se encienden cuando exista la evidencia jurídica.',
      };
    });
  }

  /**
   * Desplegar una iglesia.
   *
   * ⛔ Una sola llamada hace lo que antes eran seis pasos a mano: crea la
   * sede colgada de la maestra, le aplica los módulos de su plantilla,
   * deja apagados los de compuerta legal y le asigna su pastor. La base
   * exige alcance de organización: una sede no crea otra sede.
   */
  @Post('iglesias')
  crearIglesia(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'desplegar una iglesia');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [r] } = await c.query(
          `SELECT sistema.crear_iglesia($1,$2,$3::org.tipo_sede,$4::char(2),$5,$6,$7,$8::smallint) AS id`,
          [texto(b?.codigo, 'codigo', { min: 2, max: 20 }),
           texto(b?.nombre, 'nombre', { min: 3, max: 120 }),
           texto(b?.tipo, 'tipo', { min: 4, max: 30 }),
           texto(b?.pais, 'pais', { min: 2, max: 2 }),
           texto(b?.ciudad, 'ciudad', { min: 2, max: 80 }),
           texto(b?.plantilla, 'plantilla', { min: 2, max: 30 }),
           uuid(b?.pastorId, 'pastorId'),
           b?.ola === undefined || b?.ola === null ? null : entero(b.ola, 'ola', { min: 1, max: 20 })]);
        return {
          id: r.id,
          mensaje: 'Iglesia desplegada con su plantilla y su pastor. '
                 + 'Los módulos con compuerta legal quedaron apagados hasta que haya evidencia jurídica.',
        };
      } catch (e: any) {
        traducir(e, { '23505': 'Ya existe una iglesia con ese código.' });
      }
    });
  }

  /** Registrar a una persona. Es el otro despliegue del comando central. */
  @Post('personas')
  crearPersona(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 2, 'registrar a una persona');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [p] } = await c.query(
          `INSERT INTO nucleo.personas
             (sede_id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
              tipo_documento, numero_documento, fecha_nacimiento, email_principal, telefono_movil)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10)
           RETURNING id`,
          [uuid(b?.sedeId, 'sedeId'),
           texto(b?.primerNombre, 'primerNombre', { min: 2, max: 60 }),
           textoOpcional(b?.segundoNombre, 'segundoNombre', { max: 60 }),
           texto(b?.primerApellido, 'primerApellido', { min: 2, max: 60 }),
           textoOpcional(b?.segundoApellido, 'segundoApellido', { max: 60 }),
           textoOpcional(b?.tipoDocumento, 'tipoDocumento', { max: 10 }),
           textoOpcional(b?.numeroDocumento, 'numeroDocumento', { max: 40 }),
           textoOpcional(b?.fechaNacimiento, 'fechaNacimiento', { max: 10 }),
           textoOpcional(b?.email, 'email', { max: 160 }),
           textoOpcional(b?.telefono, 'telefono', { max: 40 })]);
        return { id: p.id, mensaje: 'Persona registrada. Ya se le puede crear cuenta y otorgar roles.' };
      } catch (e: any) {
        traducir(e, {
          '23505': 'Ya hay alguien con ese documento.',
          '23503': 'Esa sede no está en su alcance.',
          ...(String(e.message).includes('personas_documento_completo') ? { '23514':
            'El documento va completo o no va: si escribe el número, elija también el tipo (CC, TI, CE…), y al revés.' } : {}),
          /* ⛔ Una restricción de la base es una frase para quien la
             escribió, no para quien está llenando un formulario: el
             equipo de la central veía «violates check constraint
             personas_documento_completo» y no sabía qué corregir. */
        });
      }
    });
  }

  /** Los equipos de la central: contabilidad, tesorería, pastoral, regiones. */
  @Get('unidades')
  unidades(@Req() req: Request) {
    exigirNivel(req, 2, 'ver los equipos');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT u.id, u.codigo, u.nombre, u.clase, u.padre_id, u.proposito, u.activa,
                pa.nombre AS padre, li.nombre_completo AS lider,
                (SELECT count(*) FROM org.unidad_miembros m
                  WHERE m.unidad_id = u.id AND m.hasta IS NULL AND m.revocado_en IS NULL) AS integrantes,
                (SELECT count(*) FROM identidad.asignaciones_unidad a
                  WHERE a.unidad_id = u.id AND a.revocada_en IS NULL) AS roles
           FROM org.unidades u
           LEFT JOIN org.unidades pa ON pa.id = u.padre_id
           LEFT JOIN nucleo.v_personas li ON li.id = u.lider_persona_id
          ORDER BY u.clase, u.nombre`);
      const sinRol = rows.filter(u => u.clase === 'equipo' && Number(u.roles) === 0).length;
      return {
        total_filas: rows.length, unidades: rows,
        aviso: sinRol ? `${sinRol} equipo(s) sin ningún rol otorgado: existen pero no pueden hacer nada.` : null,
      };
    });
  }

  /** Crear un equipo. */
  @Post('unidades')
  crearUnidad(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'crear un equipo');
    return conSesion(this.db, req, async (c) => {
      try {
        /* ⛔ Por función: `org.unidades` es de solo lectura para la
           aplicación, y tiene que seguir siéndolo. Crear una dirección de
           la central es un acto estructural, no una operación del día. */
        const { rows: [u] } = await c.query(
          `SELECT org.crear_equipo($1,$2,$3,$4,$5,$6) AS id`,
          [texto(b?.codigo, 'codigo', { min: 2, max: 30 }),
           texto(b?.nombre, 'nombre', { min: 3, max: 120 }),
           texto(b?.clase, 'clase', { min: 4, max: 20 }),
           /* El propósito es obligatorio y largo a propósito: un equipo
              sin propósito escrito es un equipo que nadie sabe por qué
              tiene los permisos que tiene. */
           texto(b?.proposito, 'proposito', { min: 15, max: 400 }),
           b?.padreId ? uuid(b.padreId, 'padreId') : null,
           b?.liderId ? uuid(b.liderId, 'liderId') : null]);
        return { id: u.id, mensaje: 'Equipo creado. Ahora otórguele su rol: un equipo sin rol no puede hacer nada.' };
      } catch (e: any) {
        traducir(e, { '23505': 'Ya existe un equipo con ese código.' });
        throw e;
      }
    });
  }

  /** Meter a alguien en un equipo. Hereda los roles del equipo. */
  @Post('unidades/:id/miembros')
  meterEnEquipo(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    /* ⛔ N4, no N3. Un auditor lo midió: meter a una persona en un equipo
       que ya sostiene un rol de alcance de ORGANIZACIÓN la vuelve global
       al instante, con su token vivo y sin volver a entrar. Es decir, una
       acción de N3 producía el efecto de una de N4 (la de otorgar un rol
       al equipo). Los dos caminos piden ahora lo mismo. */
    exigirNivel(req, 4, 'meter a alguien en un equipo');
    return conSesion(this.db, req, async (c) => {
      try {
        await c.query(`SELECT org.meter_en_equipo($1,$2,$3)`,
          [uuid(id, 'id'), uuid(b?.personaId, 'personaId'),
           textoOpcional(b?.rolEnUnidad, 'rolEnUnidad', { max: 40 }) ?? 'integrante']);
        return {
          mensaje: 'Integrante agregado. ⛔ Hereda los roles del equipo desde este instante: '
                 + 'revise qué alcanza el equipo antes de dejarlo así.',
        };
      } catch (e: any) {
        traducir(e, {
          '23505': 'Esa persona ya está en el equipo.',
          '23503': 'El equipo o la persona no existen.',
        });
        throw e;
      }
    });
  }

  /** Sacar a alguien. Surte efecto en el instante, y exige motivo. */
  @Post('unidades/:id/miembros/:personaId/salir')
  sacarDeEquipo(@Req() req: Request, @Param('id') id: string,
                @Param('personaId') personaId: string, @Body() b: any) {
    exigirNivel(req, 3, 'sacar a alguien de un equipo');
    return conSesion(this.db, req, async (c) => {
      await c.query(`SELECT org.sacar_del_equipo($1,$2,$3)`,
        [uuid(id, 'id'), uuid(personaId, 'personaId'),
         texto(b?.motivo, 'motivo', { min: 5, max: 300 })]);
      return { mensaje: 'Fuera del equipo, y sin esperar a mañana: los permisos heredados se cortan ya.' };
    });
  }

  /** Los integrantes y los roles de un equipo. */
  @Get('unidades/:id')
  fichaUnidad(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'ver un equipo');
    return conSesion(this.db, req, async (c) => {
      const u = uuid(id, 'id');
      const { rows: [unidad] } = await c.query(
        `SELECT u.id, u.codigo, u.nombre, u.clase, u.proposito, u.activa,
                li.nombre_completo AS lider
           FROM org.unidades u LEFT JOIN nucleo.v_personas li ON li.id = u.lider_persona_id
          WHERE u.id = $1`, [u]);
      if (!unidad) throw new BadRequestException('Ese equipo no existe.');
      const { rows: miembros } = await c.query(
        `SELECT m.id, m.persona_id, p.nombre_completo, m.rol_en_unidad,
                to_char(m.desde,'YYYY-MM-DD') AS desde,
                to_char(m.hasta,'YYYY-MM-DD') AS hasta, m.motivo_salida
           FROM org.unidad_miembros m JOIN nucleo.v_personas p ON p.id = m.persona_id
          WHERE m.unidad_id = $1 AND m.revocado_en IS NULL
          ORDER BY m.hasta NULLS FIRST, p.nombre_completo`, [u]);
      const { rows: roles } = await c.query(
        `SELECT a.id, a.rol, a.alcance_tipo, a.nivel_max,
                to_char(a.vigente_desde,'YYYY-MM-DD') AS desde,
                to_char(a.vigente_hasta,'YYYY-MM-DD') AS hasta, a.acta_referencia
           FROM identidad.asignaciones_unidad a
          WHERE a.unidad_id = $1 AND a.revocada_en IS NULL
          ORDER BY a.nivel_max DESC`, [u]);
      const { rows: sedes } = await c.query(
        /* ⛔ `sedes_de_unidad` devuelve uuid[], no un conjunto de filas:
           tratarla como tabla daba «operator does not exist: uuid = uuid[]». */
        `SELECT s.codigo, s.nombre
           FROM org.sedes s
          WHERE s.id = ANY(org.sedes_de_unidad($1))
          ORDER BY s.codigo`, [u]);
      return {
        unidad,
        miembros: { activos: miembros.filter(m => !m.hasta).length, lista: miembros },
        roles,
        alcanza: sedes,
        aviso: roles.length === 0
          ? 'Este equipo no tiene ningún rol: existe, pero no puede hacer nada.'
          : null,
      };
    });
  }

  /**
   * Otorgarle un rol AL EQUIPO. Es la pieza que convierte «un grupo de
   * personas» en «contabilidad»: lo que se otorga aquí lo hereda cada
   * integrante mientras esté dentro, y se le cae al salir.
   */
  @Post('unidades/:id/roles')
  otorgarAEquipo(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 4, 'otorgar un rol a un equipo');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [a] } = await c.query(
          `INSERT INTO identidad.asignaciones_unidad
             (unidad_id, rol, alcance_tipo, alcance_id, nivel_max, vigente_hasta, otorgado_por, acta_referencia)
           VALUES ($1,$2,$3::identidad.tipo_alcance,$4,$5::smallint,$6::date,
                   plataforma.ctx_persona_id(),$7)
           RETURNING id, rol, alcance_tipo, nivel_max`,
          [uuid(id, 'id'),
           texto(b?.rol, 'rol', { min: 2, max: 40 }),
           texto(b?.alcanceTipo, 'alcanceTipo', { min: 4, max: 20 }),
           b?.alcanceId ? uuid(b.alcanceId, 'alcanceId') : null,
           entero(b?.nivelMax, 'nivelMax', { min: 1, max: 4 }),
           textoOpcional(b?.vigenteHasta, 'vigenteHasta', { max: 10 }),
           /* ⛔ El acta. Un permiso de red sin un papel detrás es un
              permiso que nadie puede explicar en una auditoría. */
           texto(b?.acta, 'acta', { min: 3, max: 200 })]);
        return { ...a, mensaje: 'Rol otorgado al equipo. Lo heredan sus integrantes desde ahora.' };
      } catch (e: any) {
        traducir(e, { '23503': 'El equipo, el rol o el alcance no existen.' });
        throw e;
      }
    });
  }

  /** Quitarle el rol al equipo. Se corta para todos sus integrantes. */
  @Post('unidades/roles/:asignacionId/revocar')
  revocarDeEquipo(@Req() req: Request, @Param('asignacionId') asignacionId: string, @Body() b: any) {
    exigirNivel(req, 4, 'revocar el rol de un equipo');
    return conSesion(this.db, req, async (c) => {
      /* ⛔ Función distinta: el rol de un equipo vive en
         `asignaciones_unidad`, no en `asignaciones`. La primera versión
         llamaba a la de personas y respondía «no existe». */
      await c.query(`SELECT identidad.revocar_asignacion_unidad($1,$2)`,
        [uuid(asignacionId, 'asignacionId'), texto(b?.motivo, 'motivo', { min: 5, max: 300 })]);
      return { mensaje: 'Rol revocado. Todos los integrantes lo pierden en este instante.' };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     GOBIERNO EDITABLE
     ⛔ Las cuatro tablas que definen quién puede qué estaban en SOLO
     LECTURA para la aplicación: se podían mirar y no tocar. Un comando
     central que no puede cambiar la matriz de permisos es un informe.
     ══════════════════════════════════════════════════════════════════ */

  /** El catálogo de módulos y el de acciones, para pintar las casillas. */
  @Get('catalogo')
  catalogo(@Req() req: Request) {
    exigirNivel(req, 2, 'ver el catálogo del sistema');
    return conSesion(this.db, req, async (c) => {
      const [m, a, r, n, td] = await Promise.all([
        c.query(`SELECT codigo, nombre, esquema, nivel_dato, es_nucleo, exige_compuerta_legal, depende_de, orden
                   FROM sistema.modulos ORDER BY orden, nombre`),
        c.query(`SELECT codigo, nombre, orden, es_sensible, modulo, descripcion
                   FROM sistema.acciones ORDER BY orden, codigo`),
        c.query(`SELECT codigo, nombre, alcance_maximo, nivel_maximo, descripcion, activo
                   FROM identidad.roles ORDER BY nivel_maximo DESC, nombre`),
        c.query(`SELECT nivel, codigo, descripcion, exige_cifrado, exige_bitacora_lect
                   FROM plataforma.niveles_sensibilidad ORDER BY nivel`),
        /* ⛔ Los tipos de documento salen del CATÁLOGO, no de una lista
           escrita en el frontend: la central los cambia sin desplegar. */
        c.query(`SELECT codigo, etiqueta, descripcion
                   FROM sistema.catalogo_valores
                  WHERE catalogo='tipo_documento' AND vigente AND retirado_en IS NULL
                  ORDER BY orden`),
      ]);
      return { modulos: m.rows, acciones: a.rows, roles: r.rows,
               niveles: n.rows, tiposDocumento: td.rows };
    });
  }

  /** La matriz: rol × módulo × acción, con la casilla ya marcada o no. */
  @Get('matriz')
  matriz(@Req() req: Request, @Query('rol') rol?: string) {
    exigirNivel(req, 3, 'ver la matriz de permisos');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(`SELECT * FROM sistema.ver_matriz($1)`,
        [textoOpcional(rol, 'rol', { max: 40 })]);
      const enganosos = rows.filter(r => r.marcado && r.por_encima);
      return {
        total_filas: rows.length, matriz: rows,
        aviso: enganosos.length
          ? `⛔ ${enganosos.length} permiso(s) marcados sobre módulos cuyo dato está POR ENCIMA del techo del rol. `
            + 'La casilla se puede marcar, pero la base no devolverá una sola fila: es un permiso que engaña.'
          : null,
      };
    });
  }

  /** Marcar o desmarcar UNA casilla. */
  @Post('matriz')
  marcarPermiso(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'cambiar la matriz de permisos');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [r] } = await c.query(
          `SELECT sistema.marcar_permiso($1,$2,$3,$4,$5::smallint,$6) AS marcado`,
          [texto(b?.rol, 'rol', { min: 2, max: 40 }),
           texto(b?.modulo, 'modulo', { min: 2, max: 40 }),
           texto(b?.accion, 'accion', { min: 2, max: 40 }),
           booleano(b?.marcado, 'marcado'),
           b?.nivelMax === undefined || b?.nivelMax === null ? null : entero(b.nivelMax, 'nivelMax', { min: 0, max: 4 }),
           textoOpcional(b?.acta, 'acta', { max: 200 })]);
        return { marcado: r.marcado, mensaje: r.marcado ? 'Permiso otorgado.' : 'Permiso quitado.' };
      } catch (e: any) {
        traducir(e);
      }
    });
  }

  /** Crear o editar un rol, con su techo y su alcance máximo. */
  @Post('roles')
  guardarRol(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'crear o cambiar un rol');
    return conSesion(this.db, req, async (c) => {
      try {
        await c.query(`SELECT identidad.guardar_rol($1,$2,$3,$4::smallint,$5,$6)`,
          [texto(b?.codigo, 'codigo', { min: 2, max: 40 }),
           texto(b?.nombre, 'nombre', { min: 3, max: 120 }),
           texto(b?.alcanceMaximo, 'alcanceMaximo', { min: 4, max: 30 }),
           entero(b?.nivelMaximo, 'nivelMaximo', { min: 0, max: 4 }),
           textoOpcional(b?.descripcion, 'descripcion', { max: 400 }),
           /* ⛔ `undefined` viaja como NULL y la función lo entiende como
              «no lo toque». Antes se mandaba `true` por omisión, así que
              cambiarle el nombre a un rol descontinuado lo devolvía a la
              circulación sin que nadie lo pidiera. */
           typeof b?.activo === 'boolean' ? b.activo : null]);
        return { mensaje: 'Rol guardado. Los permisos que le sobren por encima del techo dejan de servir.' };
      } catch (e: any) {
        traducir(e);
      }
    });
  }

  /** Crear o editar una plantilla de iglesia. */
  @Post('plantillas')
  guardarPlantilla(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'crear o cambiar una plantilla');
    return conSesion(this.db, req, async (c) => {
      try {
        await c.query(`SELECT sistema.guardar_plantilla($1,$2,$3,$4)`,
          [texto(b?.codigo, 'codigo', { min: 2, max: 30 }),
           texto(b?.nombre, 'nombre', { min: 3, max: 120 }),
           texto(b?.tipoSede, 'tipoSede', { min: 4, max: 30 }),
           textoOpcional(b?.descripcion, 'descripcion', { max: 400 })]);
        return { mensaje: 'Plantilla guardada. Marque los módulos que debe traer una iglesia nueva.' };
      } catch (e: any) {
        traducir(e, { '22P02': 'Ese tipo de sede no existe.' });
        throw e;
      }
    });
  }

  /** La casilla de un módulo dentro de una plantilla. */
  @Post('plantillas/:codigo/modulos')
  marcarModuloPlantilla(@Req() req: Request, @Param('codigo') codigo: string, @Body() b: any) {
    exigirNivel(req, 4, 'cambiar los módulos de una plantilla');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [r] } = await c.query(
          `SELECT sistema.marcar_modulo_de_plantilla($1,$2,$3) AS marcado`,
          [texto(codigo, 'codigo', { min: 2, max: 30 }),
           texto(b?.modulo, 'modulo', { min: 2, max: 40 }),
           booleano(b?.marcado, 'marcado')]);
        return { marcado: r.marcado, mensaje: r.marcado ? 'Módulo añadido a la plantilla.' : 'Módulo quitado.' };
      } catch (e: any) {
        traducir(e);
      }
    });
  }

  @Post('plantillas/:codigo/borrar')
  borrarPlantilla(@Req() req: Request, @Param('codigo') codigo: string) {
    exigirNivel(req, 4, 'borrar una plantilla');
    return conSesion(this.db, req, async (c) => {
      try {
        await c.query(`SELECT sistema.borrar_plantilla($1)`, [texto(codigo, 'codigo', { min: 2, max: 30 })]);
        return { mensaje: 'Plantilla borrada.' };
      } catch (e: any) {
        traducir(e);
      }
    });
  }

  /** La ficha de una persona: su cuenta, sus roles y sus sesiones. */
  @Get('personas/:id')
  fichaPersona(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 3, 'ver la ficha de una persona');
    return conSesion(this.db, req, async (c) => {
      const p = uuid(id, 'id');
      const { rows: [persona] } = await c.query(
        `SELECT p.id, p.nombre_completo, p.numero_documento, p.tipo_documento,
                p.email_principal, p.telefono_movil, p.estado, p.edad, p.es_menor,
                s.codigo AS sede, s.nombre AS sede_nombre
           FROM nucleo.v_personas p LEFT JOIN org.sedes s ON s.id = p.sede_id
          WHERE p.id = $1`, [p]);
      if (!persona) throw new NotFoundException('Esa persona no existe o no está en su alcance.');
      const { rows: cuenta } = await c.query(
        `SELECT * FROM identidad.listar_cuentas(NULL, 500)`);
      const { rows: roles } = await c.query(
        `SELECT a.id, a.rol, r.nombre AS rol_nombre, a.alcance_tipo, a.alcance_id, a.nivel_max,
                to_char(a.vigente_desde,'YYYY-MM-DD') AS desde,
                to_char(a.vigente_hasta,'YYYY-MM-DD') AS hasta, a.acta_referencia
           FROM identidad.asignaciones a
           LEFT JOIN identidad.roles r ON r.codigo = a.rol
          WHERE a.persona_id = $1 AND a.revocada_en IS NULL
          ORDER BY a.nivel_max DESC`, [p]);
      const { rows: equipos } = await c.query(
        `SELECT u.id, u.nombre, u.clase, m.rol_en_unidad
           FROM org.unidad_miembros m JOIN org.unidades u ON u.id = m.unidad_id
          WHERE m.persona_id = $1 AND m.hasta IS NULL AND m.revocado_en IS NULL`, [p]);
      return {
        persona,
        cuenta: cuenta.find((x: any) => x.persona_id === p) ?? null,
        roles, equipos,
        aviso: roles.length === 0 && equipos.length === 0
          ? 'Esta persona no tiene ningún rol ni equipo: puede entrar y no ve nada.' : null,
      };
    });
  }

  /** La ficha de una iglesia: qué ve, quién la atiende y quién la alcanza. */
  @Get('sedes/:id')
  fichaSede(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'ver la ficha de una iglesia');
    return conSesion(this.db, req, async (c) => {
      const s = uuid(id, 'id');
      const { rows: [sede] } = await c.query(
        `SELECT s.id, s.codigo, s.nombre, s.tipo, s.pais, s.ciudad, s.activa,
                pa.codigo AS sede_padre, s.ola_migracion
           FROM org.sedes s LEFT JOIN org.sedes pa ON pa.id = s.sede_padre_id
          WHERE s.id = $1`, [s]);
      if (!sede) throw new NotFoundException('Esa iglesia no existe o no está en su alcance.');
      const { rows: [conteo] } = await c.query(
        `SELECT (SELECT count(*) FROM nucleo.personas p WHERE p.sede_id = $1 AND p.eliminado_en IS NULL) AS personas,
                (SELECT count(*) FROM grupos.grupos g WHERE g.sede_id = $1 AND g.cerrado_en IS NULL) AS grupos,
                (SELECT count(*) FROM sistema.modulos_sede ms WHERE ms.sede_id = $1 AND ms.activo) AS modulos_encendidos`,
        [s]);
      const { rows: equipo } = await c.query(
        /* ⛔ Faltaban `desde` y `rol_nombre`: la columna «Desde» de
           «Quién la pastorea» salía en guion en TODAS las filas. */
        `SELECT a.persona_id, p.nombre_completo AS persona, p.nombre_completo,
                a.rol, r.nombre AS rol_nombre, a.nivel_max,
                to_char(a.vigente_desde, 'YYYY-MM-DD') AS desde
           FROM identidad.asignaciones a
           JOIN nucleo.v_personas p ON p.id = a.persona_id
           LEFT JOIN identidad.roles r ON r.codigo = a.rol
          WHERE a.alcance_tipo = 'sede' AND a.alcance_id = $1 AND a.revocada_en IS NULL
            AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
          ORDER BY a.nivel_max DESC, p.nombre_completo`, [s]);
      const { rows: unidades } = await c.query(
        `SELECT u.id, u.nombre, u.clase FROM org.unidades u
          WHERE $1 = ANY(org.sedes_de_unidad(u.id)) AND u.activa
          ORDER BY u.clase, u.nombre`, [s]);
      return {
        sede, conteo, equipo, unidades,
        aviso: equipo.some(e => e.rol === 'PASTOR_CONGREGACIONAL')
          ? null
          : '⛔ Esta iglesia NO tiene pastor congregacional asignado. Una sede sin pastor no se opera sola.',
      };
    });
  }

  /** La auditoría: quién hizo qué. */
  @Get('auditoria')
  auditoria(@Req() req: Request, @Query('limite') limite?: string) {
    exigirNivel(req, 4, 'ver la auditoría');
    return conSesion(this.db, req, async (c) => {
      /* ⛔ Conceder SELECT sobre la auditoría a la aplicación la haría
         legible por cualquier sesión, que es justo lo que existe para
         impedir. Se lee por función, con el mismo guardia. */
      const { rows } = await c.query(`SELECT * FROM plataforma.ver_auditoria($1)`,
        [limite ? entero(limite, 'limite', { min: 1, max: 500 }) : 100]);
      return { total_filas: rows.length, movimientos: rows };
    });
  }

  /** La bitácora de lectura: quién MIRÓ los datos sensibles. */
  @Get('lecturas')
  lecturas(@Req() req: Request, @Query('limite') limite?: string) {
    exigirNivel(req, 4, 'ver la bitácora de lectura');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(`SELECT * FROM plataforma.ver_bitacora_lectura($1)`,
        [limite ? entero(limite, 'limite', { min: 1, max: 500 }) : 100]);
      return {
        total_filas: rows.length, lecturas: rows,
        aviso: 'Esta bitácora existe para que mirar por curiosidad tenga nombre y hora.',
      };
    });
  }
}

@Module({ imports: [DbModule], controllers: [AdministracionController] })
export class AdministracionModule {}
