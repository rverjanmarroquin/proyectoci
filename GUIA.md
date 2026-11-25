# Guia paso a paso: Pipeline CI/CD con Jenkins (restaurante)

## 0. Requisitos (instalar una sola vez)
- **VS Code** (extensiones recomendadas: se sugieren solas al abrir la carpeta)
- **Git** y una cuenta de **GitHub**
- **Node.js 20** (solo para generar el `package-lock.json` y probar local)
- **Docker Desktop** abierto y funcionando (en Windows, con WSL2)

## 1. Abrir el proyecto y generar el lockfile
1. VS Code > Archivo > Abrir carpeta > `restaurante-cicd`.
2. Terminal (Ctrl+`):
```bash
npm install            # genera package-lock.json (OBLIGATORIO: Jenkins y Docker usan npm ci)
npm run lint
npm test               # debe pasar con cobertura >= 80%
npm start              # abre http://localhost:3000 y prueba el formulario
```
(Sin base de datos usa memoria. Detén con Ctrl+C.)

## 2. Subir el proyecto a GitHub
```bash
git init
git add .
git commit -m "Proyecto inicial: reservas de restaurante"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/restaurante-cicd.git
git push -u origin main
```
Repositorio publico (mas simple). Si es privado, crea un token en GitHub y agregalo en Jenkins como credencial.

## 3. Levantar Jenkins y SonarQube
```bash
docker compose -f docker-compose.jenkins.yml up -d --build
```
- Jenkins: http://localhost:8080  - SonarQube: http://localhost:9000 (tarda ~2 min)

**Jenkins (primera vez)**
1. Clave inicial: `docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword`
2. "Install suggested plugins" y crea tu usuario administrador.

**SonarQube**
1. Entra con `admin` / `admin` y cambia la clave.
2. Arriba a la derecha: *My Account > Security > Generate Tokens* (tipo *User Token*). Copia el token.

## 4. Credencial del token de Sonar en Jenkins
Manage Jenkins > Credentials > System > Global > Add Credentials:
- Kind: **Secret text** - Secret: *(el token de Sonar)* - ID: **`sonar-token`** (exactamente asi)

## 5. Crear el job del pipeline
1. New Item > nombre `restaurante-pipeline` > **Pipeline** > OK.
2. En *Pipeline*: Definition = **Pipeline script from SCM** - SCM = **Git** - Repository URL = tu repo de GitHub - Branch = `*/main` - Script Path = `Jenkinsfile`.
3. Guardar > **Build Now**.

## 6. Resultado esperado
- Staging: http://localhost:3001 - Produccion (simulada): http://localhost:3002
- Se archivan: cobertura, reporte k6, reporte ZAP y reporte Playwright (en la pagina del build > *Build Artifacts*).
- El Quality Gate aparece en SonarQube > proyecto *Restaurante API*.

La primera ejecucion descarga muchas imagenes (10-15 min). Las siguientes toman ~7 min.

## 7. Simulacion de fallos (para la evidencia del documento)
**a) Falla de pruebas unitarias.** En `src/reservasService.js`, en `seSolapan`, cambia `< DURACION_MIN` por `<= DURACION_MIN`. Haz commit y push: Jest falla en la etapa 4, las etapas siguientes se omiten (no hay despliegue). Corrige, vuelve a subir y pasa a verde.

**b) Secreto expuesto (Gitleaks).** Agrega a cualquier archivo `.js` la linea `const token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789";` y haz push: falla en la etapa 1. Eliminala y sube de nuevo.

**c) Rollback en produccion.** Primero deja un build bueno desplegado en prod. Luego, en `src/app.js`, dentro de la ruta `/health`, agrega como primera linea: `if (process.env.ENV_NAME === 'prod') return res.status(503).json({ status: 'error' });` (la app recibe `ENV_NAME` desde el compose). Haz push: staging y todas las pruebas pasan, pero el smoke test de produccion falla y en el log veras `ROLLBACK de prod`; produccion vuelve a la version anterior. Despues quita la linea para dejar todo en verde.

**d) Quality Gate / Trivy.** Sube la cobertura exigida (en `package.json`) a 99 para ver fallar Jest, o baja `FROM node:20-alpine` a una version antigua (por ejemplo `node:16-alpine`) para ver fallar Trivy.

## 8. Capturas que debes tomar (evidencias reales)
1. Vista de etapas del pipeline (*Stage View*) en verde.
2. Log de consola de un build exitoso.
3. Log del build fallido (pruebas unitarias) y luego el corregido.
4. SonarQube con el Quality Gate aprobado.
5. Resumen de k6 (p95) y reporte de ZAP.
6. El formulario funcionando en http://localhost:3001.
7. Log del rollback (si lo simulas).

## 9. Correspondencia con el documento
| Herramienta | Donde esta | Etapa |
|---|---|---|
| Git / GitHub | repositorio + `pollSCM` | 1 |
| Jenkins | `Jenkinsfile` | todas |
| Gitleaks | etapa 1 + `.gitleaks.toml` | 1 |
| Node.js / npm | `package.json` | 2 |
| ESLint | `eslint.config.js` | 3 |
| npm audit | etapa 3 | 3 |
| Jest + Supertest | `tests/` | 4 |
| SonarQube | `sonar-project.properties` | 4b |
| Docker | `Dockerfile` | 5 |
| Trivy | etapa 5 | 5 |
| Docker Compose + PostgreSQL | `docker-compose.app.yml`, `scripts/deploy.sh` | 6 y 8 |
| Playwright | `e2e/` | 7 |
| k6 | `tests/load/reservas.js` | 7 |
| OWASP ZAP | etapa 7 | 7 |
| Rollback | `scripts/rollback.sh` | 8 |

Nota: el documento PDF usaba GitHub Actions; aqui el orquestador es **Jenkins** (el `Jenkinsfile` reemplaza al `ci-cd.yml`). Las etapas son las mismas.

## 10. Problemas frecuentes
- **`npm ci` falla / no hay lockfile:** ejecuta `npm install` y haz commit de `package-lock.json` (y de `e2e/package-lock.json` es opcional).
- **`docker: not found` en Jenkins:** reconstruye con `docker compose -f docker-compose.jenkins.yml up -d --build`.
- **`permission denied` al docker.sock:** el contenedor Jenkins debe correr con `user: root` (ya configurado).
- **Sonar no arranca (Linux/WSL):** `sudo sysctl -w vm.max_map_count=262144`.
- **Error "network cicd-net not found":** `docker network create cicd-net`.
- **Windows y scripts `.sh`:** el `.gitattributes` fuerza finales de linea LF; si aun falla, en VS Code cambia CRLF a LF (barra inferior).
- **Puertos ocupados:** cambia 3001/3002 en el `Jenkinsfile` y en `scripts/rollback.sh`.
- **Limpiar todo:** `docker compose -f docker-compose.jenkins.yml down -v` y `docker rm -f $(docker ps -aq --filter name=restaurante-)`.
