import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { FiltroDeErrores } from './comun/errores';
import { revisarSecretosAlArrancar, enProduccion } from './comun/secretos';

async function arrancar() {
  /* ⛔ Primero los secretos. Si en producción falta uno o es de juguete,
     la aplicación NO ARRANCA. Un sistema que levanta con una llave de
     desarrollo es peor que uno que no levanta: parece que funciona. */
  revisarSecretosAlArrancar();

  const app = await NestFactory.create(AppModule, {
    logger: enProduccion() ? ['log', 'warn', 'error'] : ['log', 'warn', 'error', 'debug'],
  });
  app.enableShutdownHooks();
  app.useGlobalFilters(new FiltroDeErrores());

  /* Cuerpo acotado: sin esto, una petición de 200 MB tumba el proceso. */
  const express = require('express');
  app.use(express.json({ limit: '1mb' }));

  /* ⛔ CORS con lista blanca, jamás asterisco. Un `origin: '*'` en una API
     que mueve datos N3 y N4 significa que cualquier página abierta en el
     navegador de un pastor podría llamarla con su sesión. */
  const permitidos = (process.env.CORS_ORIGENES ??
    'http://127.0.0.1:5199,http://localhost:5199,https://casaroca-system.netlify.app')
    .split(',').map(x => x.trim()).filter(Boolean);
  app.enableCors({
    origin: permitidos,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Peticion-Id'],
    exposedHeaders: ['X-Peticion-Id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    maxAge: 600,
  });

  const puerto = Number(process.env.PORT ?? 3000);
  await app.listen(puerto, '0.0.0.0');
  new Logger('CasaRoca').log(
    `API en :${puerto} · base ${process.env.PGDATABASE ?? 'casaroca_dev'} como ${process.env.PGUSER ?? 'casaroca_app'} ` +
    `· entorno ${process.env.NODE_ENV ?? 'development'} · origenes ${permitidos.length}`);
}
arrancar().catch(e => { new Logger('CasaRoca').error(`No arranca: ${e.message}`); process.exit(1); });
