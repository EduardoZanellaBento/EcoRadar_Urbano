/**
 * Evidências de infraestrutura (item 9.6 da APS):
 *  - Swagger UI de cada microsserviço (via gateway)
 *  - Painel de gerenciamento do RabbitMQ (visão geral, conexões AMQP/MQTT, exchanges, filas)
 *  - Saída de "docker compose ps" (texto e imagem)
 *  - Logs de cada serviço em registros/logs/servicos
 * Uso: npm run prints-infra (na pasta tests)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { API, RAIZ, REGISTROS } from '../utils/api.js';
import { compose } from '../utils/docker.js';
import { terminalParaPng } from '../utils/imagem.js';

const PRINTS_SWAGGER = resolve(REGISTROS, 'screenshots', 'swagger');
const PRINTS_INFRA = resolve(REGISTROS, 'screenshots', 'infraestrutura');
const LOGS = resolve(REGISTROS, 'logs', 'servicos');
for (const p of [PRINTS_SWAGGER, PRINTS_INFRA, LOGS]) mkdirSync(p, { recursive: true });

/** Lê uma variável do .env (ou do .env.example) — credenciais locais de desenvolvimento. */
function variavel(nome: string): string {
  const arquivo = existsSync(resolve(RAIZ, '.env')) ? resolve(RAIZ, '.env') : resolve(RAIZ, '.env.example');
  const linha = readFileSync(arquivo, 'utf-8').split(/\r?\n/).find((l) => l.startsWith(`${nome}=`));
  return linha ? linha.slice(nome.length + 1).trim() : '';
}

const SERVICOS = [
  { id: 'auth', nome: 'auth-service' },
  { id: 'ocorrencias', nome: 'ocorrencias-service' },
  { id: 'ambiental', nome: 'ambiental-service' },
  { id: 'alertas', nome: 'alertas-service' },
  { id: 'relatorios', nome: 'relatorios-service' },
  { id: 'simulador', nome: 'sensor-simulator' },
];

async function main() {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'pt-BR' });
  const pagina = await contexto.newPage();

  // ----- Swagger UI ----------------------------------------------------------------------
  for (const [i, s] of SERVICOS.entries()) {
    await pagina.goto(`${API}/api/${s.id}/docs`, { waitUntil: 'networkidle' });
    await pagina.locator('.opblock').first().waitFor({ timeout: 30_000 });
    await pagina.waitForTimeout(500);
    await pagina.screenshot({ path: resolve(PRINTS_SWAGGER, `${String(i + 1).padStart(2, '0')}_swagger_${s.nome}.png`), fullPage: true });
    console.log('Swagger:', s.nome);
  }
  // Uma operação expandida com o esquema de erro padronizado
  await pagina.goto(`${API}/api/ocorrencias/docs`, { waitUntil: 'networkidle' });
  await pagina.locator('.opblock-post').first().click();
  await pagina.waitForTimeout(800);
  await pagina.screenshot({ path: resolve(PRINTS_SWAGGER, '07_swagger_ocorrencias_post_detalhado.png'), fullPage: false });

  // ----- Painel do RabbitMQ ---------------------------------------------------------------
  const porta = variavel('RABBITMQ_PAINEL_PORTA') || '15672';
  const painel = `http://localhost:${porta}`;
  await pagina.goto(painel, { waitUntil: 'networkidle' });
  await pagina.locator('input[name="username"]').fill(variavel('RABBITMQ_USUARIO'));
  await pagina.locator('input[name="password"]').fill(variavel('RABBITMQ_SENHA'));
  await pagina.locator('input[type="submit"], button[type="submit"]').first().click();
  await pagina.waitForTimeout(3000);
  const abas: Array<[string, string]> = [
    ['#/', '01_rabbitmq_visao_geral'],
    ['#/connections', '02_rabbitmq_conexoes_amqp_mqtt'],
    ['#/exchanges', '03_rabbitmq_exchanges'],
    ['#/queues', '04_rabbitmq_filas'],
  ];
  for (const [hash, nome] of abas) {
    await pagina.goto(`${painel}/${hash}`);
    await pagina.waitForTimeout(3500);
    await pagina.screenshot({ path: resolve(PRINTS_INFRA, `${nome}.png`), fullPage: true });
    console.log('RabbitMQ:', nome);
  }
  await pagina.goto(`${painel}/#/exchanges/%2F/ecoradar.eventos`);
  await pagina.waitForTimeout(3500);
  await pagina.screenshot({ path: resolve(PRINTS_INFRA, '05_rabbitmq_exchange_ecoradar_eventos.png'), fullPage: true });
  await navegador.close();

  // ----- docker compose ps -------------------------------------------------------------
  const ps = compose('ps --format "table {{.Name}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"');
  writeFileSync(resolve(PRINTS_INFRA, 'docker_compose_ps.txt'), ps, 'utf-8');
  await terminalParaPng('docker compose ps', `$ docker compose ps\n${ps}`, resolve(PRINTS_INFRA, '06_docker_compose_ps.png'), 1800);
  const imagens = compose('images');
  writeFileSync(resolve(PRINTS_INFRA, 'docker_compose_images.txt'), imagens, 'utf-8');

  // ----- Logs de cada serviço ----------------------------------------------------------
  const nomes = compose('config --services').split(/\r?\n/).filter(Boolean).filter((n) => n !== 'seed');
  for (const n of nomes) {
    writeFileSync(resolve(LOGS, `${n}.log`), compose(`logs --no-color --timestamps --tail 3000 ${n}`, { ignorarErro: true }), 'utf-8');
  }
  console.log('Logs salvos:', nomes.join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
