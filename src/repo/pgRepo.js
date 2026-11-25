'use strict';
const { Pool, types } = require('pg');

types.setTypeParser(1082, (v) => v); // DATE se devuelve como texto AAAA-MM-DD

function createPgRepo(connectionString) {
  const pool = new Pool({ connectionString });
  const mapear = (r) => ({ id: r.id, nombre: r.nombre, email: r.email, fecha: r.fecha, hora: r.hora, personas: r.personas });

  return {
    async init(intentos = 20) {
      for (let i = 1; i <= intentos; i += 1) {
        try {
          await pool.query(`CREATE TABLE IF NOT EXISTS reservas (
            id SERIAL PRIMARY KEY,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL,
            fecha DATE NOT NULL,
            hora VARCHAR(5) NOT NULL,
            personas INT NOT NULL,
            creada TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
          await pool.query('CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas (fecha)');
          return;
        } catch (e) {
          if (i === intentos) throw e;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    },
    async ping() {
      await pool.query('SELECT 1');
      return true;
    },
    async listar(limite = 50) {
      const { rows } = await pool.query('SELECT * FROM reservas ORDER BY id DESC LIMIT $1', [limite]);
      return rows.map(mapear);
    },
    async listarPorFecha(fecha) {
      const { rows } = await pool.query('SELECT * FROM reservas WHERE fecha = $1', [fecha]);
      return rows.map(mapear);
    },
    async crear(r) {
      const { rows } = await pool.query(
        'INSERT INTO reservas (nombre, email, fecha, hora, personas) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [r.nombre, r.email, r.fecha, r.hora, r.personas],
      );
      return mapear(rows[0]);
    },
    async cancelar(id) {
      const { rowCount } = await pool.query('DELETE FROM reservas WHERE id = $1', [id]);
      return rowCount > 0;
    },
  };
}

module.exports = { createPgRepo };
