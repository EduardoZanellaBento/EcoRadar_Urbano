// Registra as versões EXATAS em uso (ferramentas, imagens/servidores em execução e pacotes
// instalados) em registros/ambiente/versoes.txt.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCKER_WIN = 'C:\\Program Files\\Docker\\Docker\\resources\\bin';
if (process.platform === 'win32' && existsSync(DOCKER_WIN) && !process.env.PATH.includes(DOCKER_WIN)) process.env.PATH = `${DOCKER_WIN};${process.env.PATH}`;

const cmd = (c, cwd = raiz) => {
  try {
    return execSync(c, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split(/\r?\n/)[0];
  } catch {
    return 'indisponível';
  }
};
const versaoPacote = (pasta, pacote) => {
  const p = resolve(raiz, pasta, 'node_modules', pacote, 'package.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')).version : '—';
};
const exec = (servico, c) => cmd(`docker compose exec -T ${servico} ${c}`);

const l = [];
const add = (rotulo, valor) => l.push(`${rotulo.padEnd(28, '.')} ${valor}`);
l.push(`# Versões utilizadas — EcoRadar Urbano (gerado em ${new Date().toLocaleString('pt-BR')})`, '');
l.push('## Ferramentas do computador');
add('Node.js', cmd('node -v'));
add('npm', cmd('npm -v'));
add('Git', cmd('git --version'));
add('Docker', cmd('docker --version'));
add('Docker Compose', cmd('docker compose version'));
add('Sistema', `${process.platform} ${process.arch}`);

l.push('', '## Servidores em execução (versão reportada pelo próprio servidor)');
add('PostgreSQL', exec('postgres', 'psql -U ecoradar_admin -d ecoradar -tAc "SHOW server_version"'));
add('PostGIS', exec('postgres', 'psql -U ecoradar_admin -d ecoradar -tAc "SELECT postgis_lib_version()"'));
add('RabbitMQ', exec('rabbitmq', 'rabbitmqctl version'));
add('Nginx', exec('gateway', 'nginx -v 2>&1'));
add('Node.js (containers)', exec('auth-service', 'node -v'));

l.push('', '## Imagens Docker (docker compose images)');
try {
  const lista = JSON.parse(execSync('docker compose images --format json', { cwd: raiz, encoding: 'utf-8' }));
  const imagens = [...new Set(lista.map((i) => `${i.Repository}:${i.Tag}`))].sort();
  for (const i of imagens) l.push(`  ${i}`);
} catch {
  l.push('  indisponível (stack parada?)');
}

l.push('', '## Backend (pacotes instalados)');
for (const p of ['typescript', 'fastify', 'zod', 'drizzle-orm', 'drizzle-kit', 'pg', 'amqplib', 'mqtt', 'opossum', 'socket.io', 'pdfkit', 'pino', '@fastify/swagger', 'bcryptjs', 'esbuild', 'vitest', 'eslint', 'typescript-eslint']) {
  add(p, versaoPacote('backend', p));
}
l.push('', '## App móvel (pacotes instalados)');
for (const p of ['expo', 'react-native', 'react', 'react-native-web', 'expo-router', 'react-native-paper', 'react-native-maps', 'react-leaflet', 'leaflet', 'zustand', '@tanstack/react-query', 'axios', 'socket.io-client', 'react-native-gifted-charts', 'react-native-svg', 'expo-location', 'expo-image-picker', 'expo-notifications', 'expo-secure-store', 'expo-file-system', 'expo-sharing', '@react-native-community/netinfo', 'typescript']) {
  add(p, versaoPacote('mobile', p));
}
l.push('', '## Testes');
for (const p of ['@playwright/test', 'vitest', 'autocannon', 'sharp', 'pdfjs-dist']) add(p, versaoPacote('tests', p));
const chromium = cmd('npx playwright --version', resolve(raiz, 'tests'));
add('Playwright CLI', chromium);
l.push('', 'Observação: TypeScript 6.0.x (e não 7.x) porque o typescript-eslint suporta até TS < 6.1;', 'o template do Expo SDK 57 também usa TypeScript ~6.0.3.');
writeFileSync(resolve(raiz, 'registros', 'ambiente', 'versoes.txt'), l.join('\n') + '\n');
console.log(l.join('\n'));
