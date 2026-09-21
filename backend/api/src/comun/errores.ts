import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Manejo central de errores.
 *
 * ⛔ Dos reglas. Primera: el usuario recibe un mensaje en castellano y el
 * identificador de su petición, nunca la estructura interna. Un error de
 * la base que dice «violates foreign key constraint casos_topico_fkey» le
 * regala a quien ataca el nombre de las tablas y sus relaciones.
 * Segunda: el detalle técnico se registra completo, del lado del servidor.
 */
const log = new Logger('Error');

const TRADUCCIONES: Record<string, { estado: number; mensaje: string }> = {
  '23505': { estado: HttpStatus.CONFLICT,   mensaje: 'Ese registro ya existe.' },
  '23503': { estado: HttpStatus.BAD_REQUEST, mensaje: 'El registro hace referencia a algo que no existe o que ya no está vigente.' },
  '23514': { estado: HttpStatus.BAD_REQUEST, mensaje: 'Los datos no cumplen una regla del sistema.' },
  '23502': { estado: HttpStatus.BAD_REQUEST, mensaje: 'Falta un dato obligatorio.' },
  '42501': { estado: HttpStatus.FORBIDDEN,  mensaje: 'No tiene permiso para esta operación.' },
  '57014': { estado: HttpStatus.GATEWAY_TIMEOUT, mensaje: 'La consulta tardó demasiado y se canceló.' },
  // ⛔ Un identificador mal formado es un error DEL CLIENTE. Antes caía al
  //    500 genérico, y un escáner probando rutas se registraba como «error
  //    inesperado del servidor», tapando incidentes reales entre el ruido.
  '22P02': { estado: HttpStatus.BAD_REQUEST, mensaje: 'Un identificador o un valor no tiene el formato esperado.' },
  '22001': { estado: HttpStatus.BAD_REQUEST, mensaje: 'Un texto es más largo de lo que admite el campo.' },
  '22003': { estado: HttpStatus.BAD_REQUEST, mensaje: 'Un número está fuera del rango admitido.' },
  '40001': { estado: HttpStatus.CONFLICT,    mensaje: 'Otra persona cambió lo mismo al mismo tiempo. Inténtelo otra vez.' },
  '40P01': { estado: HttpStatus.CONFLICT,    mensaje: 'Dos operaciones se bloquearon entre sí. Inténtelo otra vez.' },

  /* ⛔ 20 de septiembre de 2026. Estos TRES faltaban, y son justo los que
     usan nuestras propias funciones. Todas las reglas del negocio viven
     en la base (RAISE EXCEPTION dentro de funciones SECURITY DEFINER)
     precisamente para que no se puedan saltar según por dónde entre la
     llamada. Sin estos códigos en el mapa, cada una de esas reglas subía
     como «Ocurrió un error inesperado, reporte este código al soporte»:
     la base decía en español y con el nombre del dato qué estaba mal, y
     el operador recibía un número de incidencia. */
  'P0001': { estado: HttpStatus.BAD_REQUEST, mensaje: 'La operación no cumple una regla del sistema.' },
  'P0002': { estado: HttpStatus.NOT_FOUND,   mensaje: 'No se encontró lo que se pedía.' },
  '02000': { estado: HttpStatus.NOT_FOUND,   mensaje: 'No se encontró lo que se pedía.' },
};

/* ⛔ Qué mensaje se le puede enseñar a quien está usando el sistema.
   Antes esto se decidía con una lista de PALABRAS INICIALES («La», «El»,
   «No se»…). Bastaba con que una regla empezara por «Escriba para qué
   sirve el rol…» o «Es el único rol que administra la red…» para que el
   mensaje, escrito a mano para esa situación, se tirara a la basura y
   saliera el texto genérico.
   La pregunta correcta no es cómo empieza la frase, sino QUIÉN la
   escribió: si la escribió el motor, filtra la estructura interna y no
   sale; si la escribió una función nuestra, es para leerse. */
const JERGA = /violates|constraint|relation "|column "|syntax error|duplicate key|invalid input|permission denied for|type "|operator does not exist/i;
function esParaElUsuario(codigo: string, mensaje?: string): boolean {
  if (!mensaje) return false;
  if (JERGA.test(mensaje)) return false;
  /* Lo que lanza nuestro código a propósito. */
  return ['P0001', 'P0002', '02000', '23514', '42501'].includes(codigo);
}

@Catch()
export class FiltroDeErrores implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const id = (req as any).peticionId ?? 'sin-id';

    if (e instanceof HttpException) {
      const cuerpo = e.getResponse();
      const mensaje = typeof cuerpo === 'string' ? cuerpo : (cuerpo as any)?.mensaje ?? (cuerpo as any)?.message ?? 'Error';
      /* ⛔ 20 de septiembre de 2026. Aquí se reconstruía el cuerpo con TRES
         campos y se tiraba todo lo demás. Parece inofensivo y dejaba a
         media iglesia fuera del sistema: al entrar con el segundo factor
         ya activo, `auth.service` lanza
         `UnauthorizedException({ mensaje, faltaSegundoFactor: true })`, y
         esa bandera es la que hace que la pantalla enseñe el campo de los
         seis dígitos. Como se perdía aquí, el campo NO APARECÍA NUNCA:
         quien ya tenía el segundo factor activo —es decir, todo el que
         alcanza datos N4: menores, consejería, aportes— no podía volver a
         entrar. El primer ingreso funciona porque va por otra rama.
         Se conservan los campos extra. El mensaje, el marcador de error y
         el identificador de la petición mandan sobre ellos, para que un
         cuerpo mal formado no pueda pisarlos. */
      const extra = (cuerpo && typeof cuerpo === 'object') ? { ...(cuerpo as any) } : {};
      delete extra.message; delete extra.statusCode; delete extra.error;
      return res.status(e.getStatus()).json({ ...extra, error: true, mensaje, peticionId: id });
    }

    /* Cuerpo demasiado grande: 413, no 500. */
    if ((e as any)?.type === 'entity.too.large' || (e as any)?.status === 413) {
      return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        error: true, mensaje: 'El contenido enviado es demasiado grande.', peticionId: id });
    }
    /* JSON mal formado: 400. */
    if (e instanceof SyntaxError && 'body' in (e as any)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: true, mensaje: 'El contenido enviado no es un JSON válido.', peticionId: id });
    }

    const codigo = (e as any)?.code as string | undefined;
    const t = codigo ? TRADUCCIONES[codigo] : undefined;

    const mensajeDeLaBase = (e as any)?.message as string | undefined;
    const esMensajeRedactado = esParaElUsuario(codigo ?? '', mensajeDeLaBase);

    log.error(`${id} ${req.method} ${req.path} · ${codigo ?? 'sin-codigo'} · ${mensajeDeLaBase ?? e}`);

    if (t && esMensajeRedactado) {
      return res.status(t.estado).json({ error: true, mensaje: mensajeDeLaBase, peticionId: id });
    }
    if (t) return res.status(t.estado).json({ error: true, mensaje: t.mensaje, peticionId: id });

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: true,
      mensaje: 'Ocurrió un error inesperado. Si vuelve a pasar, reporte este código al soporte.',
      peticionId: id,
    });
  }
}
