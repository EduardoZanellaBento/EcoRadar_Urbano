-- =============================================================================
-- EcoRadar Urbano — inicialização do PostgreSQL/PostGIS
-- Executado automaticamente pelo container na PRIMEIRA criação do volume de dados.
--
-- Padrão "database per service": cada microsserviço possui um schema próprio e um
-- usuário de banco que só enxerga o seu schema. Assim, um serviço não consegue ler
-- nem alterar os dados de outro — a comunicação entre eles acontece apenas por
-- API (HTTP) ou por eventos (RabbitMQ).
--
-- ATENÇÃO: as senhas abaixo são de DESENVOLVIMENTO e devem coincidir com o .env.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----- Usuários (roles) de cada serviço --------------------------------------
CREATE ROLE svc_auth        LOGIN PASSWORD 'auth_dev_2026';
CREATE ROLE svc_ocorrencias LOGIN PASSWORD 'ocorrencias_dev_2026';
CREATE ROLE svc_ambiental   LOGIN PASSWORD 'ambiental_dev_2026';
CREATE ROLE svc_alertas     LOGIN PASSWORD 'alertas_dev_2026';
CREATE ROLE svc_relatorios  LOGIN PASSWORD 'relatorios_dev_2026';

-- ----- Um schema por serviço, pertencente ao respectivo usuário ----------------
CREATE SCHEMA IF NOT EXISTS auth        AUTHORIZATION svc_auth;
CREATE SCHEMA IF NOT EXISTS ocorrencias AUTHORIZATION svc_ocorrencias;
CREATE SCHEMA IF NOT EXISTS ambiental   AUTHORIZATION svc_ambiental;
CREATE SCHEMA IF NOT EXISTS alertas     AUTHORIZATION svc_alertas;
CREATE SCHEMA IF NOT EXISTS relatorios  AUTHORIZATION svc_relatorios;

-- search_path padrão de cada serviço: o próprio schema + public (onde ficam os
-- tipos e funções do PostGIS)
ALTER ROLE svc_auth        SET search_path = auth, public;
ALTER ROLE svc_ocorrencias SET search_path = ocorrencias, public;
ALTER ROLE svc_ambiental   SET search_path = ambiental, public;
ALTER ROLE svc_alertas     SET search_path = alertas, public;
ALTER ROLE svc_relatorios  SET search_path = relatorios, public;

-- Nenhum serviço pode criar objetos no schema public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Fuso horário padrão das sessões e privilégio CREATE no banco (o migrador do
-- Drizzle executa "CREATE SCHEMA IF NOT EXISTS <schema do serviço>", e o PostgreSQL
-- verifica esse privilégio antes de checar se o schema já existe). Os serviços
-- continuam SEM acesso (USAGE) aos schemas uns dos outros.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'America/Sao_Paulo');
  EXECUTE format('GRANT CREATE ON DATABASE %I TO svc_auth, svc_ocorrencias, svc_ambiental, svc_alertas, svc_relatorios', current_database());
END
$$;
