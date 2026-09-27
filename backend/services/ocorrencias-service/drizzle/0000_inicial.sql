CREATE TABLE "areas_manancial" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descricao" text NOT NULL,
	"geom" geometry(MultiPolygon, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "confirmacoes" (
	"ocorrencia_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"usuario_nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "confirmacoes_pk" PRIMARY KEY("ocorrencia_id","usuario_id")
);
--> statement-breakpoint
CREATE TABLE "historico_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ocorrencia_id" uuid NOT NULL,
	"status_anterior" text,
	"status_novo" text NOT NULL,
	"comentario" text NOT NULL,
	"usuario_id" uuid NOT NULL,
	"usuario_nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocorrencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"usuario_nome" text NOT NULL,
	"categoria" text NOT NULL,
	"severidade" text NOT NULL,
	"status" text DEFAULT 'ABERTA' NOT NULL,
	"descricao" text NOT NULL,
	"localizacao" geometry(Point, 4326) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"bairro" text,
	"foto_url" text,
	"em_area_de_manancial" boolean DEFAULT false NOT NULL,
	"manancial_nome" text,
	"confirmacoes" integer DEFAULT 0 NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvido_em" timestamp with time zone,
	CONSTRAINT "ocorrencias_idempotency_key_unica" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"agregado_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"publicado_em" timestamp with time zone,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"ultimo_erro" text
);
--> statement-breakpoint
ALTER TABLE "confirmacoes" ADD CONSTRAINT "confirmacoes_ocorrencia_id_ocorrencias_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "ocorrencias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historico_status" ADD CONSTRAINT "historico_status_ocorrencia_id_ocorrencias_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "ocorrencias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "areas_manancial_geom_gist" ON "areas_manancial" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "historico_ocorrencia_idx" ON "historico_status" USING btree ("ocorrencia_id","criado_em");--> statement-breakpoint
CREATE INDEX "ocorrencias_localizacao_gist" ON "ocorrencias" USING gist ("localizacao");--> statement-breakpoint
CREATE INDEX "ocorrencias_criado_em_idx" ON "ocorrencias" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "ocorrencias_status_idx" ON "ocorrencias" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ocorrencias_categoria_idx" ON "ocorrencias" USING btree ("categoria");--> statement-breakpoint
CREATE INDEX "outbox_pendentes_idx" ON "outbox" USING btree ("criado_em") WHERE "outbox"."publicado_em" IS NULL;