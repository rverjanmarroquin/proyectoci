'use strict';

const MESAS = 10; // mesas totales del restaurante
const DURACION_MIN = 120; // una reserva ocupa la mesa 2 horas
const HORA_MIN = 12 * 60; // 12:00
const HORA_MAX = 22 * 60; // 22:00

function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function validar(data, hoy) {
  const errores = [];
  const nombre = typeof data.nombre === 'string' ? data.nombre.trim() : '';
  if (nombre.length < 2) errores.push('El nombre debe tener al menos 2 caracteres');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) errores.push('Correo electronico invalido');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fecha || '')) errores.push('Fecha invalida (AAAA-MM-DD)');
  else if (data.fecha < hoy) errores.push('La fecha no puede ser pasada');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.hora || '')) errores.push('Hora invalida (HH:MM)');
  else {
    const m = aMinutos(data.hora);
    if (m < HORA_MIN || m > HORA_MAX) errores.push('Se reciben reservas entre 12:00 y 22:00');
  }
  const p = Number(data.personas);
  if (!Number.isInteger(p) || p < 1 || p > 10) errores.push('Personas debe ser un entero entre 1 y 10');
  return errores;
}

// Dos reservas se solapan si empiezan con menos de DURACION_MIN de diferencia.
// Una reserva que empieza justo cuando termina la anterior NO se solapa.
function seSolapan(hora1, hora2) {
  return Math.abs(aMinutos(hora1) - aMinutos(hora2)) < DURACION_MIN;
}

async function disponibilidad(repo, fecha, hora) {
  const existentes = await repo.listarPorFecha(fecha);
  const ocupadas = existentes.filter((r) => seSolapan(r.hora, hora)).length;
  return { fecha, hora, mesasTotales: MESAS, mesasOcupadas: ocupadas, mesasLibres: MESAS - ocupadas };
}

async function crearReserva(repo, data, hoy) {
  const errores = validar(data, hoy);
  if (errores.length > 0) {
    const err = new Error('Datos invalidos');
    err.status = 400;
    err.detalles = errores;
    throw err;
  }
  const disp = await disponibilidad(repo, data.fecha, data.hora);
  if (disp.mesasLibres <= 0) {
    const err = new Error('No hay mesas disponibles en ese horario');
    err.status = 409;
    throw err;
  }
  return repo.crear({
    nombre: data.nombre.trim(),
    email: data.email,
    fecha: data.fecha,
    hora: data.hora,
    personas: Number(data.personas),
  });
}

module.exports = { MESAS, validar, seSolapan, disponibilidad, crearReserva };
