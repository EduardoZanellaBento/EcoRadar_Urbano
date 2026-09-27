CREATE TABLE "alertas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"severidade" text NOT NULL,
	"titulo" text NOT NULL,
	"mensagem" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"raio_km" double precision,
	"chave_area" text NOT NULL,
	"categoria" text,
	"origem" text NOT NULL,
	"referencia_id" text NOT NULL,
	"dados" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'ATIVO' NOT NULL,
	"correlation_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"encerrado_em" timestamp with time zone,
	"encerrado_por" text,
	"comentario_encerramento" text
);
--> statement-breakpoint
CREATE TABLE "eventos_processados" (
	"evento_id" uuid PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"processado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocorrencias_recentes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"categoria" text NOT NULL,
	"status" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	"versao" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "alertas_tipo_criado_idx" ON "alertas" USING btree ("tipo","criado_em");--> statement-breakpoint
CREATE INDEX "alertas_status_idx" ON "alertas" USING btree ("status","criado_em");--> statement-breakpoint
CREATE INDEX "recentes_categoria_criado_idx" ON "ocorrencias_recentes" USING btree ("categoria","criado_em");