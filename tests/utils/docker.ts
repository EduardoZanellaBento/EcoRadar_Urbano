import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { RAIZ } from './api.js';

// Garante o Docker no PATH (Docker Desktop no Windows)
const BIN_DOCKER = 'C:\\Program Files\\Docker\\Docker\\resources\\bin';
if (process.platform === 'win32' && existsSync(BIN_DOCKER) && !(process.env.PATH ?? '').includes(BIN_DOCKER)) {
  process.env.PATH = `${BIN_DOCKER};${process.env.PATH}`;
}

/** Executa "docker compose <args>" na raiz do projeto e devolve a saída (stdout + stderr). */
export function compose(args: string, opcoes: { ignorarErro?: boolean; timeoutMs?: number } = {}): string {
  const r = spawnSync(`docker compose ${args}`, { cwd: RAIZ, shell: true, encoding: 'utf-8', timeout: opcoes.timeoutMs ?? 300_000 });
  const saida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (r.status !== 0 && !opcoes.ignorarErro) throw new Error(`docker compose ${args} falhou (${r.status}):\n${saida}`);
  return saida;
}

export function docker(args: string): string {
  return execSync(`docker ${args}`, { cwd: RAIZ, encoding: 'utf-8' });
}

/** Estado de saúde de um serviço do compose (healthy/unhealthy/starting/ausente). */
export function saudeDoServico(servico: string): string {
  const id = compose(`ps -q ${servico}`, { ignorarErro: true }).trim();
  if (!id) return 'ausente';
  try {
    return docker(`inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" ${id}`).trim();
  } catch {
    return 'ausente';
  }
}
