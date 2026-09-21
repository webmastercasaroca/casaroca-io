import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { derivarClave, verificarClave, revisarPolitica } from './clave';
import { firmarToken, verificarToken, nuevoJti } from './jwt';
import { nuevoSecreto, verificarCodigo, uriDeAprovisionamiento, cifrarSecreto, descifrarSecreto } from './totp';
import { secretoObligatorio } from '../comun/secretos';
import { MAX_AUTH } from '../db/pozos';

const MINUTOS_ACCESO   = Number(process.env.APP_MINUTOS_ACCESO   ?? 30);
const MINUTOS_REFRESCO = Number(process.env.APP_MINUTOS_REFRESCO ?? 720); // 12 horas

/**
 * Autenticación.
 *
 * ⛔ Usa su propio grupo de conexiones, SIN contexto de sesión, porque
 * autenticar ocurre ANTES de que exista sesión. Todo lo que hace pasa por
 * funciones SECURITY DEFINER de la base: este servicio no puede leer la
 * tabla de cuentas ni la de sesiones, solo preguntarle a la base.
 */
@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth');
  private readonly pool = new Pool({
    host: process.env.PGHOST ?? '/tmp',
    port: Number(process.env.PGPORT ?? 5433),
    database: process.env.PGDATABASE ?? 'casaroca_dev',
    user: process.env.PGUSER ?? 'casaroca_app',
    password: process.env.PGPASSWORD || undefined,
    max: MAX_AUTH,
    // ⛔ Faltaba. Una transaccion de autenticacion colgada se quedaba
    //    con una de las cinco conexiones para siempre.
    idle_in_transaction_session_timeout: 10_000,
  } as any);

  private get secreto() { return secretoObligatorio('APP_JWT_SECRETO'); }

  /**
   * Entrar.
   *
   * ⛔ El mensaje de error es EL MISMO tanto si el usuario no existe como
   * si la contraseña está mal. Decir «ese usuario no existe» le regala a
   * quien prueba la mitad del trabajo: la lista de usuarios válidos.
   */
  async entrar(usuario: string, clave: string, ip: string | null, agente: string | null, codigo?: string) {
    const generico = 'Usuario o contraseña incorrectos.';
    if (!usuario || !clave) throw new UnauthorizedException(generico);

    const { rows } = await this.pool.query(
      `SELECT * FROM identidad.credencial_de($1)`, [usuario]);
    const c = rows[0];

    if (!c) {
      /* Se deriva una clave falsa igualmente. Sin esto, un usuario que no
         existe responde en 2 ms y uno que sí existe en 80 ms: la diferencia
         permite enumerar cuentas válidas sin acertar ni una contraseña. */
      verificarClave(clave, derivarClave('señuelo-de-tiempo-constante'));
      await this.registrar(usuario, false, 'usuario inexistente', ip, agente);
      throw new UnauthorizedException(generico);
    }

    if (c.bloqueada_hasta && new Date(c.bloqueada_hasta) > new Date()) {
      await this.registrar(usuario, false, 'cuenta bloqueada por intentos', ip, agente);
      throw new UnauthorizedException(
        'La cuenta está bloqueada temporalmente por intentos fallidos. Vuelva a intentarlo en unos minutos.');
    }
    if (c.estado !== 'activa') {
      await this.registrar(usuario, false, `cuenta en estado ${c.estado}`, ip, agente);
      throw new UnauthorizedException('La cuenta no está activa. Comuníquese con la central.');
    }
    if (!verificarClave(clave, c.clave_hash)) {
      await this.registrar(usuario, false, 'clave incorrecta', ip, agente);
      throw new UnauthorizedException(generico);
    }
    /* ── SEGUNDO FACTOR ───────────────────────────────────────────────
       Tres caminos, y los tres importan:
       1 · Ya lo tiene activo  → se exige el código de seis dígitos.
       2 · Lo necesita y no lo tiene → se entrega un token LIMITADO que
           solo sirve para configurarlo. No se le deja fuera del sistema,
           pero tampoco entra a los datos.
       3 · No lo necesita → entra normal.                                */
    if (c.segundo_factor_activo) {
      const cifrado = await this.pool.query(`SELECT identidad.secreto_segundo_factor($1) AS s`, [c.cuenta_id]);
      const secreto = descifrarSecreto(cifrado.rows[0]?.s ?? '', secretoObligatorio('APP_LLAVE_N4'));
      if (!secreto) {
        await this.registrar(usuario, false, 'segundo factor ilegible', ip, agente);
        throw new UnauthorizedException('No se pudo verificar el segundo factor. Comuníquese con la central.');
      }
      if (!codigo) {
        await this.registrar(usuario, false, 'falta el codigo del segundo factor', ip, agente);
        throw new UnauthorizedException({
          mensaje: 'Escriba el código de seis dígitos de su aplicación de autenticación.',
          faltaSegundoFactor: true,
        });
      }
      if (!verificarCodigo(secreto, codigo)) {
        await this.registrar(usuario, false, 'codigo de segundo factor incorrecto', ip, agente);
        throw new UnauthorizedException('El código de seis dígitos no es correcto o ya venció.');
      }
    } else if (c.exige_segundo_factor) {
      await this.registrar(usuario, true, 'ingreso limitado para configurar el segundo factor', ip, agente);
      const par = await this.emitirPar(c.cuenta_id, ip, agente, null, c.debe_cambiar_clave, 'configurar_mfa');
      return {
        ...par,
        debeConfigurarSegundoFactor: true,
        aviso: 'Su rol alcanza datos sensibles: antes de entrar tiene que activar el segundo factor.',
      };
    }

    await this.registrar(usuario, true, 'ingreso correcto', ip, agente);
    return this.emitirPar(c.cuenta_id, ip, agente, null, c.debe_cambiar_clave);
  }

  /** Renovar el acceso. El refresco se ROTA: usarlo dos veces lo invalida. */
  async refrescar(tokenRefresco: string, ip: string | null, agente: string | null) {
    const cuerpo = verificarToken(tokenRefresco, this.secreto);
    if (!cuerpo || cuerpo.typ !== 'refresco') throw new UnauthorizedException('Sesión no válida.');

    const { rows } = await this.pool.query(
      `SELECT * FROM identidad.contexto_de_sesion($1)`, [cuerpo.jti]);
    if (!rows[0]) throw new UnauthorizedException('La sesión ya no está activa.');

    return this.emitirPar(cuerpo.cta, ip, agente, cuerpo.jti, false);
  }

  /** Cierra la sesión ENTERA: el acceso y su refresco. */
  async salir(jti: string) {
    const { rows } = await this.pool.query(
      `SELECT identidad.cerrar_sesion($1, 'salida del usuario') AS cerrada`, [jti]);
    return { cerrada: rows[0]?.cerrada === true };
  }

  async salirDeTodo(cuentaId: string) {
    const { rows } = await this.pool.query(
      `SELECT identidad.cerrar_todas_las_sesiones($1, 'el usuario cerro todas sus sesiones') AS n`, [cuentaId]);
    return { sesionesCerradas: rows[0]?.n ?? 0 };
  }

  async cambiarClave(cuentaId: string, usuario: string, claveActual: string, claveNueva: string) {
    const problema = revisarPolitica(claveNueva);
    if (problema) throw new BadRequestException(problema);
    if (claveActual === claveNueva) throw new BadRequestException('La contraseña nueva debe ser distinta de la anterior.');

    const { rows } = await this.pool.query(`SELECT * FROM identidad.credencial_de($1)`, [usuario]);
    if (!rows[0] || !verificarClave(claveActual, rows[0].clave_hash)) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }
    await this.pool.query(`SELECT identidad.cambiar_clave($1,$2)`, [cuentaId, derivarClave(claveNueva)]);
    return { cambiada: true, aviso: 'Se cerraron las demás sesiones abiertas.' };
  }

  /** Alta de cuenta. La contraseña inicial es temporal por definición. */
  async crearCuenta(personaId: string, usuario: string, claveInicial: string, quien: string | null) {
    const problema = revisarPolitica(claveInicial);
    if (problema) throw new BadRequestException(problema);
    const { rows } = await this.pool.query(
      `SELECT identidad.crear_cuenta($1,$2,$3,$4) AS id`,
      [personaId, usuario, derivarClave(claveInicial), quien]);
    return { cuentaId: rows[0].id };
  }

  /** Contexto de un token limitado, solo para configurar el segundo factor. */
  async contextoDeTokenLimitado(token: string) {
    const cuerpo = verificarToken(token, this.secreto);
    if (!cuerpo || cuerpo.typ !== 'configurar_mfa') return null;
    const { rows } = await this.pool.query(`SELECT * FROM identidad.contexto_de_sesion($1)`, [cuerpo.jti]);
    const r = rows[0];
    if (!r) return null;
    return { cuentaId: r.cuenta_id as string, usuario: r.usuario as string, jti: cuerpo.jti };
  }

  /** La pregunta de cada petición: ¿esta sesión sigue viva y qué alcanza? */
  async contextoDeToken(token: string) {
    const cuerpo = verificarToken(token, this.secreto);
    if (!cuerpo) return null;
    /* Un token «configurar_mfa» NO abre los datos: solo las rutas de
       configuración del segundo factor, que lo aceptan explícitamente. */
    if (cuerpo.typ !== 'acceso') return null;
    const { rows } = await this.pool.query(
      `SELECT * FROM identidad.contexto_de_sesion($1)`, [cuerpo.jti]);
    const r = rows[0];
    if (!r) return null;
    return {
      personaId: r.persona_id as string,
      cuentaId: r.cuenta_id as string,
      usuario: r.usuario as string,
      jti: cuerpo.jti,
      sedeIds: (r.sede_ids ?? []) as string[],
      nivelMax: Number(r.nivel_max ?? 0),
      alcanceGlobal: Boolean(r.es_global),
    };
  }

  /** Arrancar la configuración del segundo factor: secreto y código QR. */
  async iniciarSegundoFactor(cuentaId: string, usuario: string) {
    const secreto = nuevoSecreto();
    await this.pool.query(`SELECT identidad.guardar_segundo_factor($1,$2)`,
      [cuentaId, cifrarSecreto(secreto, secretoObligatorio('APP_LLAVE_N4'))]);
    return {
      secreto,
      uri: uriDeAprovisionamiento(secreto, usuario),
      instruccion: 'Escanee el código con su aplicación de autenticación y escriba el código de seis dígitos para activarlo.',
    };
  }

  /** Confirmar que el teléfono y el servidor están sincronizados. */
  async activarSegundoFactor(cuentaId: string, codigo: string) {
    const { rows } = await this.pool.query(`SELECT identidad.secreto_segundo_factor($1) AS s`, [cuentaId]);
    const secreto = descifrarSecreto(rows[0]?.s ?? '', secretoObligatorio('APP_LLAVE_N4'));
    if (!secreto) throw new BadRequestException('Primero tiene que iniciar la configuración del segundo factor.');
    if (!verificarCodigo(secreto, codigo)) {
      throw new BadRequestException('El código no coincide. Verifique la hora de su teléfono e inténtelo otra vez.');
    }
    await this.pool.query(`SELECT identidad.activar_segundo_factor($1)`, [cuentaId]);
    return { activado: true, aviso: 'Segundo factor activo. Se cerraron las sesiones anteriores; vuelva a entrar.' };
  }

  private async emitirPar(cuentaId: string, ip: string | null, agente: string | null,
                          refrescoDe: string | null, debeCambiarClave: boolean,
                          tipo: 'acceso' | 'configurar_mfa' = 'acceso') {
    const jtiAcceso = nuevoJti();
    const jtiRefresco = nuevoJti();

    /* La aplicación NO lee la tabla de cuentas: pregunta por función. La
       tabla guarda derivaciones de contraseña y secretos de segundo factor. */
    const { rows } = await this.pool.query(
      `SELECT identidad.persona_de_cuenta($1) AS persona_id`, [cuentaId]);
    const personaId: string | null = rows[0]?.persona_id ?? null;

    /* ⛔ El acceso y su refresco se emiten ENLAZADOS. Antes eran dos
       llamadas sueltas y nada decía que fueran hermanas: cerrar sesión
       mataba el acceso y dejaba el refresco vivo doce horas. */
    await this.pool.query(`SELECT identidad.abrir_par_de_sesion($1,$2,$3,$4,$5,$6,$7,$8)`,
      [cuentaId, jtiAcceso, jtiRefresco, MINUTOS_ACCESO, MINUTOS_REFRESCO, ip, agente, refrescoDe]);

    const base = { sub: personaId ?? cuentaId, cta: cuentaId };
    return {
      acceso: firmarToken({ ...base, jti: jtiAcceso, typ: tipo }, MINUTOS_ACCESO * 60, this.secreto),
      refresco: firmarToken({ ...base, jti: jtiRefresco, typ: 'refresco' }, MINUTOS_REFRESCO * 60, this.secreto),
      expiraEnSegundos: MINUTOS_ACCESO * 60,
      debeCambiarClave,
    };
  }

  private async registrar(usuario: string, exito: boolean, motivo: string, ip: string | null, agente: string | null) {
    try {
      await this.pool.query(`SELECT identidad.registrar_intento($1,$2,$3,$4,$5)`,
        [usuario, exito, motivo, ip, agente?.slice(0, 300) ?? null]);
    } catch (e) { this.log.error(`No se pudo registrar el intento de acceso: ${e}`); }
  }
}
