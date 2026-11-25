'use strict';
const { createApp } = require('./app');
const { createMemoryRepo } = require('./repo/memoryRepo');

async function main() {
  let repo;
  if (process.env.DATABASE_URL) {
    const { createPgRepo } = require('./repo/pgRepo');
    repo = createPgRepo(process.env.DATABASE_URL);
    await repo.init();
    console.log('Conectado a PostgreSQL');
  } else {
    repo = createMemoryRepo();
    console.log('Sin DATABASE_URL: usando repositorio en memoria');
  }
  const port = process.env.PORT || 3000;
  createApp(repo).listen(port, () => console.log(`Restaurante API escuchando en :${port}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
