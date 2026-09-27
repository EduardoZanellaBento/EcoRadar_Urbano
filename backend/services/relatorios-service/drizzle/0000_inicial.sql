CREATE TABLE "alertas_view" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"severidade" text NOT NULL,
	"titulo" text NOT NULL,
	"status" text NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	"encerrado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "eventos_processados" (
	"evento_id" uuid PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"processado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocorrencias_view" (
	"id" uuid PRIMARY KEY NOT NULL,
	"categoria" text NOT NULL,
	"severidade" text NOT NULL,
	"status" text NOT NULL,
	"descricao" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"bairro" text,
	"em_area_de_manancial" boolean NOT NULL,
	"manancial_nome" text,
	"confirmacoes" integer NOT NULL,
	"usuario_nome" text NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	"atualizado_em" timestamp with time zone NOT NULL,
	"resolvido_em" timestamp with time zone,
	"versao" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "view_criado_idx" ON "ocorrencias_view" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "view_bairro_idx" ON "ocorrencias_view" USING btree ("bairro");