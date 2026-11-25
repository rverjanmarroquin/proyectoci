// Pipeline CI/CD - Sistema de reservas de restaurante
// Las herramientas de analisis (Gitleaks, SonarScanner, Trivy, Playwright, k6, ZAP)
// corren en contenedores Docker efimeros, lanzados desde Jenkins con el socket de Docker.
pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '15'))
    timeout(time: 45, unit: 'MINUTES')
  }
  triggers { pollSCM('H/2 * * * *') }   // revisa el repositorio cada ~2 minutos

  environment {
    IMAGE = 'restaurante-api'
    TAG   = "${env.BUILD_NUMBER}"
  }

  stages {

    stage('1. Source y secretos') {
      steps {
        checkout scm
        sh 'git log -1 --pretty="Commit: %h - %an - %s"'
        // Gitleaks: busca contrasenas/tokens expuestos en el codigo
        sh '''
          docker run --rm --volumes-from jenkins -w "$WORKSPACE" zricethezav/gitleaks:v8.21.2 \
            detect --source . --no-git --redact --config .gitleaks.toml
        '''
      }
    }

    stage('2. Build') {
      steps {
        sh 'node --version && npm --version'
        sh 'npm ci'
        sh 'npm run build'
      }
    }

    stage('3. Analisis estatico') {
      parallel {
        stage('ESLint') {
          steps { sh 'npm run lint' }
        }
        stage('npm audit (dependencias)') {
          steps { sh 'npm audit --audit-level=high' }
        }
      }
    }

    stage('4. Pruebas unitarias') {
      steps { sh 'npm test' }          // Jest + Supertest, cobertura minima 80%
      post { always { junit allowEmptyResults: true, testResults: 'reports/junit.xml' } }
    }

    stage('4b. SonarQube Quality Gate') {
      steps {
        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
          sh '''
            docker run --rm --volumes-from jenkins -w "$WORKSPACE" --network cicd-net \
              -e SONAR_HOST_URL=http://sonarqube:9000 -e SONAR_TOKEN \
              sonarsource/sonar-scanner-cli:11 sonar-scanner -Dsonar.qualitygate.wait=true
          '''
        }
      }
    }

    stage('5. Empaquetado Docker + Trivy') {
      steps {
        sh 'docker build -t $IMAGE:$TAG .'
        sh '''
          # Informa vulnerabilidades HIGH y CRITICAL; falla solo si hay CRITICAL
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v trivy-cache:/root/.cache/ \
            aquasec/trivy:0.57.1 image --no-progress --ignore-unfixed --severity HIGH,CRITICAL --exit-code 0 $IMAGE:$TAG
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v trivy-cache:/root/.cache/ \
            aquasec/trivy:0.57.1 image --no-progress --ignore-unfixed --severity CRITICAL --exit-code 1 $IMAGE:$TAG
        '''
      }
    }

    stage('6. Deploy a staging') {
      steps {
        sh 'bash scripts/deploy.sh staging $TAG 3001'
        sh 'bash scripts/wait-health.sh http://restaurante-staging-app:3000/health'
      }
    }

    stage('7. Pruebas de integracion y no funcionales') {
      steps {
        sh 'mkdir -p reports'
        // E2E: Playwright sobre el formulario real
        sh '''
          docker run --rm --volumes-from jenkins -w "$WORKSPACE/e2e" --network cicd-net \
            -e BASE_URL=http://restaurante-staging-app:3000 -e CI=true \
            mcr.microsoft.com/playwright:v1.48.2-jammy \
            sh -c "npm install --no-audit --no-fund && npx playwright test"
        '''
        // Rendimiento: k6 (p95 < 500 ms, errores < 1%)
        sh '''
          docker run --rm -u root --volumes-from jenkins -w "$WORKSPACE" --network cicd-net \
            -e BASE_URL=http://restaurante-staging-app:3000 -e VUS=50 \
            grafana/k6:0.54.0 run --summary-export=reports/k6-summary.json tests/load/reservas.js
        '''
        // Seguridad dinamica: OWASP ZAP baseline (0 = ok, 2 = solo advertencias, 1 = fallo)
        sh '''
          docker rm -f zap-run >/dev/null 2>&1 || true
          set +e
          docker run --name zap-run --network cicd-net ghcr.io/zaproxy/zaproxy:stable \
            zap-baseline.py -t http://restaurante-staging-app:3000 -r zap-report.html
          CODE=$?
          docker cp zap-run:/zap/wrk/zap-report.html reports/zap-report.html || true
          docker rm -f zap-run >/dev/null 2>&1
          if [ $CODE -eq 0 ] || [ $CODE -eq 2 ]; then exit 0; else exit 1; fi
        '''
      }
    }

    stage('8. Deploy a produccion (simulada)') {
      steps {
        sh 'bash scripts/deploy.sh prod $TAG 3002'
        script {
          try {
            sh 'bash scripts/wait-health.sh http://restaurante-prod-app:3000/health 10'
          } catch (err) {
            echo 'Smoke test fallido: ejecutando ROLLBACK automatico'
            sh 'bash scripts/rollback.sh prod'
            error('Smoke test en produccion fallo; se aplico rollback')
          }
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'coverage/**, reports/**, e2e/playwright-report/**', allowEmptyArchive: true
      sh 'docker image prune -f || true'
    }
    success { echo "Pipeline OK - version ${TAG} desplegada en staging (3001) y produccion (3002)" }
    failure { echo "Pipeline FALLO en la etapa indicada: merge bloqueado, revisar el log (aqui iria la notificacion a Slack/correo)" }
  }
}
