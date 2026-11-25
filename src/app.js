'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { crearReserva, disponibilidad } = require('./reservasService');

function createApp(repo, { ahora = () => new Date() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaultDirectives: true,
      directives: {
        "upgrade-insecure-requests": null,
      },
    },
  })
);
  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const publica = ({ id, nombre, fecha, hora, personas }) => ({ id, nombre, fecha, hora, personas });
  const hoy = () => ahora().toISOString().slice(0, 10);

  app.get('/health', async (req, res) => {
    try {
      await repo.ping();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'error' });
    }
  });

  app.get('/api/disponibilidad', async (req, res, next) => {
    try {
      const { fecha, hora } = req.query;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora || '')) {
        return res.status(400).json({ error: 'Parametros fecha (AAAA-MM-DD) y hora (HH:MM) requeridos' });
      }
      return res.json(await disponibilidad(repo, fecha, hora));
    } catch (e) {
      return next(e);
    }
  });

  app.get('/api/reservas', async (req, res, next) => {
    try {
      res.json((await repo.listar()).map(publica));
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/reservas', async (req, res, next) => {
    try {
      const reserva = await crearReserva(repo, req.body || {}, hoy());
      res.status(201).json({ mensaje: 'Reserva confirmada', reserva: publica(reserva) });
    } catch (e) {
      next(e);
    }
  });

  app.delete('/api/reservas/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id invalido' });
      const ok = await repo.cancelar(id);
      return ok ? res.status(204).end() : res.status(404).json({ error: 'Reserva no encontrada' });
    } catch (e) {
      return next(e);
    }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.status) return res.status(err.status).json({ error: err.message, detalles: err.detalles });
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  });

  return app;
}

module.exports = { createApp };
