'use strict';

function createMemoryRepo() {
  let seq = 0;
  let datos = [];
  return {
    async ping() {
      return true;
    },
    async listar(limite = 50) {
      return [...datos].sort((a, b) => b.id - a.id).slice(0, limite);
    },
    async listarPorFecha(fecha) {
      return datos.filter((r) => r.fecha === fecha);
    },
    async crear(reserva) {
      seq += 1;
      const nueva = { id: seq, ...reserva };
      datos.push(nueva);
      return nueva;
    },
    async cancelar(id) {
      const antes = datos.length;
      datos = datos.filter((r) => r.id !== id);
      return datos.length < antes;
    },
  };
}

module.exports = { createMemoryRepo };
