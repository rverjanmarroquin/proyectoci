const request = require('supertest');
const { createApp } = require('../src/app');
const { createMemoryRepo } = require('../src/repo/memoryRepo');

const ahora = () => new Date('2030-01-01T10:00:00Z');
const reserva = { nombre: 'Luis Gomez', email: 'luis@correo.com', fecha: '2030-03-05', hora: '13:00', personas: 4 };

describe('API de reservas', () => {
  let app;
  beforeEach(() => {
    app = createApp(createMemoryRepo(), { ahora });
  });

  test('GET /health responde 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /health responde 503 si la base de datos falla', async () => {
    const repoRoto = { ping: async () => { throw new Error('db caida'); } };
    const res = await request(createApp(repoRoto, { ahora })).get('/health');
    expect(res.status).toBe(503);
  });

  test('POST /api/reservas crea una reserva (201) y no expone el email', async () => {
    const res = await request(app).post('/api/reservas').send(reserva);
    expect(res.status).toBe(201);
    expect(res.body.reserva.nombre).toBe('Luis Gomez');
    expect(res.body.reserva.email).toBeUndefined();
  });

  test('POST /api/reservas con datos invalidos responde 400', async () => {
    const res = await request(app).post('/api/reservas').send({ ...reserva, email: 'malo' });
    expect(res.status).toBe(400);
    expect(res.body.detalles.length).toBeGreaterThan(0);
  });

  test('POST /api/reservas responde 409 cuando no hay mesas', async () => {
    for (let i = 0; i < 10; i += 1) await request(app).post('/api/reservas').send(reserva);
    const res = await request(app).post('/api/reservas').send(reserva);
    expect(res.status).toBe(409);
  });

  test('GET /api/reservas lista las reservas', async () => {
    await request(app).post('/api/reservas').send(reserva);
    const res = await request(app).get('/api/reservas');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('GET /api/disponibilidad valida parametros y responde', async () => {
    expect((await request(app).get('/api/disponibilidad')).status).toBe(400);
    const ok = await request(app).get('/api/disponibilidad?fecha=2030-03-05&hora=13:00');
    expect(ok.status).toBe(200);
    expect(ok.body.mesasLibres).toBe(10);
  });

  test('DELETE /api/reservas/:id cancela, 404 si no existe, 400 si id invalido', async () => {
    const creada = await request(app).post('/api/reservas').send(reserva);
    const id = creada.body.reserva.id;
    expect((await request(app).delete(`/api/reservas/${id}`)).status).toBe(204);
    expect((await request(app).delete(`/api/reservas/${id}`)).status).toBe(404);
    expect((await request(app).delete('/api/reservas/abc')).status).toBe(400);
  });

  test('errores inesperados responden 500 sin filtrar detalles', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const repoRoto = { listar: async () => { throw new Error('boom'); } };
    const res = await request(createApp(repoRoto, { ahora })).get('/api/reservas');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Error interno');
    spy.mockRestore();
  });
});
