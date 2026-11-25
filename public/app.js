(function () {
  const form = document.getElementById('form-reserva');
  const mensaje = document.getElementById('mensaje');
  const lista = document.getElementById('lista');
  const horaSel = document.getElementById('hora');
  const fechaInp = document.getElementById('fecha');

  for (let m = 12 * 60; m <= 22 * 60; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const opt = document.createElement('option');
    opt.value = hh + ':' + mm;
    opt.textContent = hh + ':' + mm;
    horaSel.appendChild(opt);
  }
  const hoy = new Date();
  fechaInp.min = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');

  function mostrar(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = tipo;
  }

  async function cargarLista() {
    const res = await fetch('/api/reservas');
    const reservas = await res.json();
    lista.replaceChildren();
    reservas.forEach(function (r) {
      const li = document.createElement('li');
      const texto = document.createElement('span');
      texto.textContent = r.nombre + ' - ' + r.fecha + ' ' + r.hora + ' (' + r.personas + ' pers.)';
      const btn = document.createElement('button');
      btn.textContent = 'Cancelar';
      btn.addEventListener('click', async function () {
        await fetch('/api/reservas/' + r.id, { method: 'DELETE' });
        cargarLista();
      });
      li.appendChild(texto);
      li.appendChild(btn);
      lista.appendChild(li);
    });
  }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    const datos = Object.fromEntries(new FormData(form).entries());
    const res = await fetch('/api/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    const cuerpo = await res.json();
    if (res.ok) {
      mostrar(cuerpo.mensaje + ' para ' + cuerpo.reserva.nombre, 'ok');
      form.reset();
      document.getElementById('personas').value = 2;
    } else {
      mostrar((cuerpo.detalles || [cuerpo.error]).join('. '), 'error');
    }
    cargarLista();
  });

  cargarLista();
})();
