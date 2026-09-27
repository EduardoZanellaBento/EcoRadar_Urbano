CREATE TABLE "cache_integracoes" (
	"chave" text PRIMARY KEY NOT NULL,
	"dados" jsonb NOT NULL,
	"obtido_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estacoes" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"bairro" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"tipos" text[] NOT NULL,
	"corrego" text,
	"cota_alerta_cm" integer,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leituras" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leituras_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"estacao_id" text NOT NULL,
	"medido_em" timestamp with time zone NOT NULL,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"pm25" double precision,
	"pm10" double precision,
	"o3" double precision,
	"no2" double precision,
	"co" double precision,
	"temperatura" double precision,
	"umidade" double precision,
	"nivel_corrego_cm" double precision,
	"temp_superficie" double precision,
	"temp_300m" double precision,
	"iqar" integer,
	"iqar_classe" text,
	"poluente_dominante" text,
	"inversao" boolean DEFAULT false NOT NULL,
	"cenario" text
);
--> statement-breakpoint
ALTER TABLE "leituras" ADD CONSTRAINT "leituras_estacao_id_estacoes_id_fk" FOREIGN KEY ("estacao_id") REFERENCES "estacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leituras_estacao_medido_idx" ON "leituras" USING btree ("estacao_id","medido_em" DESC NULLS LAST);