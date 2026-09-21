/**
 * Contratos del Módulo de Nuevos.
 * Los nombres de campo son los del documento M-Nuevos del equipo 100p:
 * el contrato es suyo porque construyen el frontend.
 */

export interface RegistrarNuevo {
  nombre: string;
  email?: string;
  telefono?: string;
  como_supo?: 'google' | 'amigo' | 'evento' | 'redes' | 'otro';
  es_cristiano?: 'si' | 'no' | 'duda';
  comentarios?: string;
  /** Código de sede: 'BOG-CHICO', 'MED'… No texto libre. */
  sede: string;
  /** Canales que la persona autorizó en el formulario. */
  autoriza?: Array<'email' | 'sms' | 'whatsapp' | 'llamada'>;
  /** Token del reCAPTCHA del formulario de casaroca.org. */
  recaptcha_token?: string;
}

export interface RegistrarContacto {
  tipo_contacto: 'llamada' | 'visita' | 'email' | 'whatsapp' | 'mensaje';
  resumen: string;
  reaccion: 'interesado' | 'dudoso' | 'no_interesado' | 'no_contesto';
  siguiente_paso?: string;
  fecha_siguiente_contacto?: string;
  notas?: string;
}

export interface ConvertirMiembro {
  fecha_conversion?: string;
  /** Flujo 3 del documento M-Nuevos: grupo pequeño y padrino. */
  grupo_id?: string;
  padrino_id?: string;
  notas?: string;
}
