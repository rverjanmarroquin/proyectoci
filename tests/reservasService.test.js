const { validar, seSolapan, disponibilidad, crearReserva, MESAS } = require('../src/reservasService');
const { createMemoryRepo } = require('../src/repo/memoryRepo');

const HOY = '2030-01-01';
const base = { nombre: 'Ana Perez', email: 'ana@correo.com', fecha: '2030-02-10', hora: '19:00', personas: 2 };

describe('validar', () => {
  test('acepta una reserva correcta', () => {
    expect(validar(base, HOY)).toEqual([]);
  });
  test('rechaza nombre corto, email malo y personas fuera de rango', () => {
    const errores = validar({ ...base, nombre: 'A', email: 'x', personas: 11 }, HOY);
    expect(errores).toHaveLength(3);
  });
  test('rechaza fecha pasada y formato de fecha invalido', () => {
    expect(validar({ ...base, fecha: '2029-12-31' }, HOY)).toContain('La fecha no puede ser pasada');
    expect(validar({ ...base, fecha: '10/02/2030' }, HOY)).toContain('Fecha invalida (AAAA-MM-DD)');
  });
  test('rechaza horas fuera del horario o con formato invalido', () => {
    expect(validar({ ...base, hora: '23:00' }, HOY)).toContain('Se reciben reservas entre 12:00 y 22:00');
    expect(validar({ ...base, hora: '7pm' }, HOY)).toContain('Hora invalida (HH:MM)');
  });
});

describe('solapamiento y disponibilidad', () => {
  test('se solapan si empiezan con menos de 2 horas de diferencia', () => {
    expect(seSolapan('12:00', '13:30')).toBe(true);
  });
  test('NO se solapan si una empieza cuando termina la anterior', () => {
    expect(seSolapan('12:00', '14:00')).toBe(false);
  });
  test('muestra mesas libres segun reservas solapadas', async () => {
    const repo = createMemoryRepo();
    await crearReserva(repo, base, HOY);
    const d = await disponibilidad(repo, base.fecha, '20:00');
    expect(d).toMatchObject({ mesasTotales: MESAS, mesasOcupadas: 1, mesasLibres: MESAS - 1 });
  });
});

describe('crearReserva', () => {
  test('rechaza datos invalidos con status 400', async () => {
    await expect(crearReserva(createMemoryRepo(), { ...base, nombre: '' }, HOY)).rejects.toMatchObject({ status: 400 });
  });
  test('rechaza con 409 cuando todas las mesas estan ocupadas en horario solapado', async () => {
    const repo = createMemoryRepo();
    for (let i = 0; i < MESAS; i += 1) await crearReserva(repo, { ...base, hora: '12:00' }, HOY);
    await expect(crearReserva(repo, { ...base, hora: '13:00' }, HOY)).rejects.toMatchObject({ status: 409 });
  });
  test('permite reserva que empieza cuando termina la anterior', async () => {
    const repo = createMemoryRepo();
    for (let i = 0; i < MESAS; i += 1) await crearReserva(repo, { ...base, hora: '12:00' }, HOY);
    const r = await crearReserva(repo, { ...base, hora: '14:00' }, HOY);
    expect(r.id).toBeDefined();
  });
});
