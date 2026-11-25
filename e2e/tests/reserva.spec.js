const { test, expect } = require('@playwright/test');

function fechaFutura() {
  const d = new Date(Date.now() + (400 + Math.floor(Math.random() * 600)) * 86400000);
  return d.toISOString().slice(0, 10);
}
const horas = ['12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

test('flujo completo: llenar el formulario, reservar y ver la reserva en la lista', async ({ page }) => {
  const nombre = 'Cliente E2E ' + Date.now();
  await page.goto('/');
  await page.fill('#nombre', nombre);
  await page.fill('#email', 'e2e@correo.com');
  await page.fill('#fecha', fechaFutura());
  await page.selectOption('#hora', horas[Math.floor(Math.random() * horas.length)]);
  await page.fill('#personas', '3');
  await page.click('#reservar');
  await expect(page.locator('#mensaje')).toContainText('Reserva confirmada');
  await expect(page.locator('#lista')).toContainText(nombre);
});

test('la API rechaza datos invalidos', async ({ request }) => {
  const res = await request.post('/api/reservas', { data: { nombre: 'A', email: 'x', fecha: '2000-01-01', hora: '03:00', personas: 99 } });
  expect(res.status()).toBe(400);
});

test('el endpoint /health responde ok y trae cabeceras de seguridad', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.ok()).toBeTruthy();
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
});
