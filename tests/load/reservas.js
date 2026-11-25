import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409));

export const options = {
  stages: [
    { duration: '10s', target: Number(__ENV.VUS || 50) },
    { duration: '30s', target: Number(__ENV.VUS || 50) },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // requisito de rendimiento
    http_req_failed: ['rate<0.01'],   // requisito de disponibilidad
    checks: ['rate>0.99'],
  },
};

function fechaAleatoria() {
  const d = new Date(Date.now() + (30 + Math.floor(Math.random() * 335)) * 86400000);
  return d.toISOString().slice(0, 10);
}

export default function () {
  const fecha = fechaAleatoria();
  const hora = ['12:00', '14:00', '16:00', '18:00', '20:00', '22:00'][Math.floor(Math.random() * 6)];

  const disp = http.get(`${BASE}/api/disponibilidad?fecha=${fecha}&hora=${hora}`);
  check(disp, { 'disponibilidad 200': (r) => r.status === 200 });

  if (Math.random() < 0.2) {
    const body = JSON.stringify({ nombre: 'Carga k6', email: 'k6@correo.com', fecha, hora, personas: 2 });
    const res = http.post(`${BASE}/api/reservas`, body, { headers: { 'Content-Type': 'application/json' } });
    check(res, { 'reserva 201 o 409': (r) => r.status === 201 || r.status === 409 });
  }
  sleep(0.5);
}
