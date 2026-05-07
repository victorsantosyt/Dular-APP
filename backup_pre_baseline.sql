--
-- PostgreSQL database dump
--

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg13+1)
-- Dumped by pg_dump version 18beta1 (Postgres.app)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: FeatureKey; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."FeatureKey" AS ENUM (
    'SOLICITACOES_MES',
    'CHAT_ATIVO',
    'HISTORICO_COMPLETO',
    'SUPORTE_PRIORITARIO'
);


ALTER TYPE public."FeatureKey" OWNER TO postgres;

--
-- Name: IncidentSeverity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."IncidentSeverity" AS ENUM (
    'BAIXA',
    'MEDIA',
    'ALTA'
);


ALTER TYPE public."IncidentSeverity" OWNER TO postgres;

--
-- Name: IncidentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."IncidentStatus" AS ENUM (
    'ABERTO',
    'EM_ANALISE',
    'CONFIRMADO',
    'ENCERRADO'
);


ALTER TYPE public."IncidentStatus" OWNER TO postgres;

--
-- Name: IncidentType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."IncidentType" AS ENUM (
    'ASSEDIO',
    'IMPORTUNACAO',
    'VIOLENCIA',
    'AMEACA',
    'OUTRO'
);


ALTER TYPE public."IncidentType" OWNER TO postgres;

--
-- Name: MessageType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MessageType" AS ENUM (
    'TEXT',
    'IMAGE',
    'LOCATION',
    'SYSTEM'
);


ALTER TYPE public."MessageType" OWNER TO postgres;

--
-- Name: OAuthProvider; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OAuthProvider" AS ENUM (
    'GOOGLE',
    'APPLE'
);


ALTER TYPE public."OAuthProvider" OWNER TO postgres;

--
-- Name: SafetyEventType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SafetyEventType" AS ENUM (
    'CHECKIN_OK',
    'SOS_SILENT'
);


ALTER TYPE public."SafetyEventType" OWNER TO postgres;

--
-- Name: ServicoCategoria; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ServicoCategoria" AS ENUM (
    'FAXINA_LEVE',
    'FAXINA_PESADA',
    'FAXINA_COMPLETA',
    'BABA_DIURNA',
    'BABA_NOTURNA',
    'BABA_INTEGRAL',
    'COZINHEIRA_DIARIA',
    'COZINHEIRA_EVENTO',
    'PASSA_ROUPA_BASICO',
    'PASSA_ROUPA_COMPLETO'
);


ALTER TYPE public."ServicoCategoria" OWNER TO postgres;

--
-- Name: ServicoStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ServicoStatus" AS ENUM (
    'RASCUNHO',
    'SOLICITADO',
    'ACEITO',
    'RECUSADO',
    'CANCELADO',
    'EM_ANDAMENTO',
    'CONCLUIDO',
    'CONFIRMADO',
    'FINALIZADO'
);


ALTER TYPE public."ServicoStatus" OWNER TO postgres;

--
-- Name: ServicoTipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ServicoTipo" AS ENUM (
    'FAXINA',
    'BABA',
    'COZINHEIRA',
    'PASSA_ROUPA'
);


ALTER TYPE public."ServicoTipo" OWNER TO postgres;

--
-- Name: SubscriptionPlan; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SubscriptionPlan" AS ENUM (
    'FREE',
    'BASIC',
    'PREMIUM'
);


ALTER TYPE public."SubscriptionPlan" OWNER TO postgres;

--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'TRIAL',
    'ACTIVE',
    'CANCELED',
    'EXPIRED'
);


ALTER TYPE public."SubscriptionStatus" OWNER TO postgres;

--
-- Name: TransactionType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TransactionType" AS ENUM (
    'CREDIT',
    'DEBIT',
    'REFUND'
);


ALTER TYPE public."TransactionType" OWNER TO postgres;

--
-- Name: Turno; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Turno" AS ENUM (
    'MANHA',
    'TARDE'
);


ALTER TYPE public."Turno" OWNER TO postgres;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserRole" AS ENUM (
    'CLIENTE',
    'DIARISTA',
    'ADMIN'
);


ALTER TYPE public."UserRole" OWNER TO postgres;

--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserStatus" AS ENUM (
    'ATIVO',
    'BLOQUEADO'
);


ALTER TYPE public."UserStatus" OWNER TO postgres;

--
-- Name: VerificacaoStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."VerificacaoStatus" AS ENUM (
    'PENDENTE',
    'VERIFICADO',
    'REPROVADO'
);


ALTER TYPE public."VerificacaoStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Avaliacao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Avaliacao" (
    id text NOT NULL,
    "servicoId" text NOT NULL,
    "clientId" text NOT NULL,
    "diaristaId" text NOT NULL,
    "notaGeral" integer NOT NULL,
    pontualidade integer NOT NULL,
    qualidade integer NOT NULL,
    comunicacao integer NOT NULL,
    comentario text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Avaliacao" OWNER TO postgres;

--
-- Name: Bairro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Bairro" (
    id text NOT NULL,
    nome text NOT NULL,
    cidade text NOT NULL,
    uf text NOT NULL
);


ALTER TABLE public."Bairro" OWNER TO postgres;

--
-- Name: ChatMessage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ChatMessage" (
    id text NOT NULL,
    "roomId" text NOT NULL,
    "senderId" text NOT NULL,
    content text NOT NULL,
    type public."MessageType" DEFAULT 'TEXT'::public."MessageType" NOT NULL,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ChatMessage" OWNER TO postgres;

--
-- Name: ChatRoom; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ChatRoom" (
    id text NOT NULL,
    "servicoId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ChatRoom" OWNER TO postgres;

--
-- Name: CreditTransaction; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CreditTransaction" (
    id text NOT NULL,
    "walletId" text NOT NULL,
    type public."TransactionType" NOT NULL,
    amount integer NOT NULL,
    description text,
    "servicoId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."CreditTransaction" OWNER TO postgres;

--
-- Name: CreditWallet; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CreditWallet" (
    id text NOT NULL,
    "userId" text NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CreditWallet" OWNER TO postgres;

--
-- Name: DiaristaBairro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DiaristaBairro" (
    id text NOT NULL,
    "diaristaId" text NOT NULL,
    "bairroId" text NOT NULL
);


ALTER TABLE public."DiaristaBairro" OWNER TO postgres;

--
-- Name: DiaristaHabilidade; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DiaristaHabilidade" (
    id text NOT NULL,
    "diaristaId" text NOT NULL,
    tipo public."ServicoTipo" NOT NULL,
    categoria public."ServicoCategoria",
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."DiaristaHabilidade" OWNER TO postgres;

--
-- Name: DiaristaProfile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DiaristaProfile" (
    id text NOT NULL,
    "userId" text NOT NULL,
    verificacao public."VerificacaoStatus" DEFAULT 'PENDENTE'::public."VerificacaoStatus" NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "fotoUrl" text,
    "docUrl" text,
    bio text,
    "precoLeve" integer NOT NULL,
    "precoPesada" integer NOT NULL,
    "notaMedia" double precision DEFAULT 0 NOT NULL,
    "totalServicos" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."DiaristaProfile" OWNER TO postgres;

--
-- Name: Disponibilidade; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Disponibilidade" (
    id text NOT NULL,
    "diaristaId" text NOT NULL,
    "diaSemana" integer NOT NULL,
    turno public."Turno" NOT NULL,
    ativo boolean DEFAULT true NOT NULL
);


ALTER TABLE public."Disponibilidade" OWNER TO postgres;

--
-- Name: FeatureLimit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."FeatureLimit" (
    id text NOT NULL,
    plan public."SubscriptionPlan" NOT NULL,
    feature public."FeatureKey" NOT NULL,
    "limit" integer,
    enabled boolean DEFAULT true NOT NULL
);


ALTER TABLE public."FeatureLimit" OWNER TO postgres;

--
-- Name: IncidentAttachment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."IncidentAttachment" (
    id text NOT NULL,
    "incidentId" text NOT NULL,
    key text NOT NULL,
    mime text NOT NULL,
    size integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."IncidentAttachment" OWNER TO postgres;

--
-- Name: IncidentReport; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."IncidentReport" (
    id text NOT NULL,
    "reportedById" text NOT NULL,
    "reportedUserId" text NOT NULL,
    "serviceId" text,
    type public."IncidentType" NOT NULL,
    severity public."IncidentSeverity" DEFAULT 'MEDIA'::public."IncidentSeverity" NOT NULL,
    description text NOT NULL,
    status public."IncidentStatus" DEFAULT 'ABERTO'::public."IncidentStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."IncidentReport" OWNER TO postgres;

--
-- Name: OAuthAccount; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."OAuthAccount" (
    id text NOT NULL,
    "userId" text NOT NULL,
    provider public."OAuthProvider" NOT NULL,
    "providerId" text NOT NULL,
    email text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."OAuthAccount" OWNER TO postgres;

--
-- Name: SafetyEvent; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SafetyEvent" (
    id text NOT NULL,
    type public."SafetyEventType" NOT NULL,
    "userId" text NOT NULL,
    "serviceId" text,
    lat double precision,
    lng double precision,
    meta jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."SafetyEvent" OWNER TO postgres;

--
-- Name: Servico; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Servico" (
    id text NOT NULL,
    status public."ServicoStatus" DEFAULT 'SOLICITADO'::public."ServicoStatus" NOT NULL,
    tipo public."ServicoTipo" NOT NULL,
    data timestamp(3) without time zone NOT NULL,
    turno public."Turno" NOT NULL,
    cidade text NOT NULL,
    uf text NOT NULL,
    bairro text NOT NULL,
    "enderecoCompleto" text,
    observacoes text,
    "temPet" boolean DEFAULT false NOT NULL,
    "quartos3Mais" boolean DEFAULT false NOT NULL,
    "banheiros2Mais" boolean DEFAULT false NOT NULL,
    "precoFinal" integer NOT NULL,
    "clientId" text NOT NULL,
    "diaristaId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    categoria public."ServicoCategoria"
);


ALTER TABLE public."Servico" OWNER TO postgres;

--
-- Name: ServicoEvento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ServicoEvento" (
    id text NOT NULL,
    "servicoId" text NOT NULL,
    "fromStatus" public."ServicoStatus" NOT NULL,
    "toStatus" public."ServicoStatus" NOT NULL,
    "actorRole" public."UserRole" NOT NULL,
    "actorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ServicoEvento" OWNER TO postgres;

--
-- Name: Subscription; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Subscription" (
    id text NOT NULL,
    "userId" text NOT NULL,
    plan public."SubscriptionPlan" DEFAULT 'FREE'::public."SubscriptionPlan" NOT NULL,
    status public."SubscriptionStatus" DEFAULT 'TRIAL'::public."SubscriptionStatus" NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "canceledAt" timestamp(3) without time zone,
    "externalId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Subscription" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    nome text NOT NULL,
    telefone text,
    email text,
    "senhaHash" text,
    role public."UserRole",
    status public."UserStatus" DEFAULT 'ATIVO'::public."UserStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "avatarUrl" text,
    "riskScore" integer DEFAULT 0 NOT NULL,
    "riskTier" integer DEFAULT 0 NOT NULL,
    cpf text,
    "dataNascimento" timestamp(3) without time zone,
    "pushToken" text
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Data for Name: Avaliacao; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Avaliacao" (id, "servicoId", "clientId", "diaristaId", "notaGeral", pontualidade, qualidade, comunicacao, comentario, "createdAt") FROM stdin;
\.


--
-- Data for Name: Bairro; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Bairro" (id, nome, cidade, uf) FROM stdin;
cmk516b6b0000u5yvgyk12apt	Centro	Cuiaba	MT
cmk516brh0001u5yvgch28cwq	Jardim Italia	Cuiaba	MT
cmk516cfq0002u5yvn6ze0svt	CPA	Cuiaba	MT
cmk516d0e0003u5yvicl5bxtk	Santa Rosa	Cuiaba	MT
cmk5qnssw0000e2yvoio6hbhp	Centro	Cuiabá	MT
cmk5qntde0001e2yvzf7h17jr	Santa Rosa	Cuiabá	MT
cmk5qntx80002e2yvjulh33rx	Jardim Itália	Cuiabá	MT
\.


--
-- Data for Name: ChatMessage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ChatMessage" (id, "roomId", "senderId", content, type, "readAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: ChatRoom; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ChatRoom" (id, "servicoId", "createdAt") FROM stdin;
\.


--
-- Data for Name: CreditTransaction; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CreditTransaction" (id, "walletId", type, amount, description, "servicoId", "createdAt") FROM stdin;
\.


--
-- Data for Name: CreditWallet; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CreditWallet" (id, "userId", balance, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: DiaristaBairro; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DiaristaBairro" (id, "diaristaId", "bairroId") FROM stdin;
cmkzmt3fj0006cmyvrqm3m522	cmkzmt2xu0005cmyvpnw4r4nw	cmk516b6b0000u5yvgyk12apt
cmkzmt4450007cmyv7n82e1o2	cmkzmt2xu0005cmyvpnw4r4nw	cmk516d0e0003u5yvicl5bxtk
cmkzmt4s30008cmyvso56zsey	cmkzmt2xu0005cmyvpnw4r4nw	cmk5qnssw0000e2yvoio6hbhp
cmkzmt5i40009cmyvdw1n7a6b	cmkzmt2xu0005cmyvpnw4r4nw	cmk5qntde0001e2yvzf7h17jr
cmkzmt6wc000fcmyvkkaen9fb	cmkzmt6f3000ecmyvxcyt4cij	cmk516b6b0000u5yvgyk12apt
cmkzmt7kg000gcmyvwre1544i	cmkzmt6f3000ecmyvxcyt4cij	cmk516brh0001u5yvgch28cwq
cmkzmt88p000hcmyvcyzvdkg8	cmkzmt6f3000ecmyvxcyt4cij	cmk5qnssw0000e2yvoio6hbhp
cmkzmt9jw000mcmyvu0z89oxj	cmkzmt931000lcmyv0yhkrxiu	cmk516d0e0003u5yvicl5bxtk
cmkzmta94000ncmyv90dtwqbd	cmkzmt931000lcmyv0yhkrxiu	cmk516b6b0000u5yvgyk12apt
cmkzmtaxm000ocmyvl7k116hz	cmkzmt931000lcmyv0yhkrxiu	cmk5qntde0001e2yvzf7h17jr
cmkzmtbny000pcmyvbpn6kiqa	cmkzmt931000lcmyv0yhkrxiu	cmk5qnssw0000e2yvoio6hbhp
\.


--
-- Data for Name: DiaristaHabilidade; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DiaristaHabilidade" (id, "diaristaId", tipo, categoria, "createdAt") FROM stdin;
cmkzzbdxq0003iqyvyxu2lhf6	cmkzmt2qk0004cmyvq0ixqrmq	FAXINA	FAXINA_LEVE	2026-01-29 21:41:30.683
cmkzzbdxq0004iqyvjpsfnp8m	cmkzmt2qk0004cmyvq0ixqrmq	FAXINA	FAXINA_PESADA	2026-01-29 21:41:30.683
cmkzzbi4a000aiqyvpgetwkud	cmkzmt67q000dcmyvwnn79w51	BABA	BABA_DIURNA	2026-01-29 21:41:36.103
cmkzzbn2b000fiqyvi3f75era	cmkzmt8yh000kcmyvdox5wf2u	FAXINA	FAXINA_COMPLETA	2026-01-29 21:41:42.511
cmkzzbn2c000giqyv3rnf4pqu	cmkzmt8yh000kcmyvdox5wf2u	PASSA_ROUPA	PASSA_ROUPA_BASICO	2026-01-29 21:41:42.511
\.


--
-- Data for Name: DiaristaProfile; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DiaristaProfile" (id, "userId", verificacao, ativo, "fotoUrl", "docUrl", bio, "precoLeve", "precoPesada", "notaMedia", "totalServicos", "createdAt", "updatedAt") FROM stdin;
cmkzmt2xu0005cmyvpnw4r4nw	cmkzmt2qk0004cmyvq0ixqrmq	VERIFICADO	t	\N	\N	Capricho e pontualidade.	15000	22000	0	0	2026-01-29 15:51:21.378	2026-01-29 21:41:30.38
cmkzmt6f3000ecmyvxcyt4cij	cmkzmt67q000dcmyvwnn79w51	VERIFICADO	t	\N	\N	Experiência em residências e pets.	16000	24000	0	0	2026-01-29 15:51:25.887	2026-01-29 21:41:35.786
cmkzmt931000lcmyv0yhkrxiu	cmkzmt8yh000kcmyvdox5wf2u	VERIFICADO	t	\N	\N	Rápido e organizado.	14000	21000	0	0	2026-01-29 15:51:29.341	2026-01-29 21:41:41.939
cmoejldai0000goyvrpr1rj55	cmodlxn8v0000qxyv5we750jv	PENDENTE	t	\N	\N	\N	0	0	0	0	2026-04-25 16:17:02.035	2026-04-25 16:17:02.035
\.


--
-- Data for Name: Disponibilidade; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Disponibilidade" (id, "diaristaId", "diaSemana", turno, ativo) FROM stdin;
cmkzmt5uk000acmyvha6stqt0	cmkzmt2xu0005cmyvpnw4r4nw	1	MANHA	t
cmkzmt5z2000bcmyv0wdc47kf	cmkzmt2xu0005cmyvpnw4r4nw	1	TARDE	t
cmkzmt63f000ccmyvudq9k28d	cmkzmt2xu0005cmyvpnw4r4nw	3	MANHA	t
cmkzmt8pj000icmyv633namj8	cmkzmt6f3000ecmyvxcyt4cij	2	MANHA	t
cmkzmt8tz000jcmyvbcec9oys	cmkzmt6f3000ecmyvxcyt4cij	4	TARDE	t
cmkzmtc04000qcmyv4wz41dn0	cmkzmt931000lcmyv0yhkrxiu	5	MANHA	t
cmkzmtc4c000rcmyvqx7ablk6	cmkzmt931000lcmyv0yhkrxiu	6	TARDE	t
\.


--
-- Data for Name: FeatureLimit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."FeatureLimit" (id, plan, feature, "limit", enabled) FROM stdin;
6024d92f-e830-4e45-9d2d-2936a54b98c6	FREE	CHAT_ATIVO	\N	f
ffebaf14-c15c-4fdb-8bc8-c58f29beb3b0	FREE	HISTORICO_COMPLETO	\N	f
968c8443-dd71-44ea-a74b-1b9b04f015db	FREE	SUPORTE_PRIORITARIO	\N	f
3ef44dfb-94a6-4f77-9a5d-da1db625eb5c	BASIC	SOLICITACOES_MES	10	t
f7ed4652-f0f4-48fa-b82b-6029bb95a754	BASIC	CHAT_ATIVO	\N	t
56b94946-081f-454d-bf40-86ac355c71ac	BASIC	HISTORICO_COMPLETO	\N	f
f974ac09-c3c9-4828-8c4d-67dcdcc22598	BASIC	SUPORTE_PRIORITARIO	\N	f
63b337b9-f123-4309-b32d-fea563800832	PREMIUM	SOLICITACOES_MES	\N	t
ceb9b8e6-237f-42e8-b91e-767eea56d62b	PREMIUM	CHAT_ATIVO	\N	t
0648a6d5-d84f-466c-b44c-7b9822e868d8	PREMIUM	HISTORICO_COMPLETO	\N	t
eb62e7ca-6cb8-4535-aece-95657cbf973e	PREMIUM	SUPORTE_PRIORITARIO	\N	t
c0ed5ca8-ed7d-4ff8-9113-37e430e25d11	FREE	SOLICITACOES_MES	0	t
\.


--
-- Data for Name: IncidentAttachment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."IncidentAttachment" (id, "incidentId", key, mime, size, "createdAt") FROM stdin;
\.


--
-- Data for Name: IncidentReport; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."IncidentReport" (id, "reportedById", "reportedUserId", "serviceId", type, severity, description, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: OAuthAccount; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."OAuthAccount" (id, "userId", provider, "providerId", email, "createdAt") FROM stdin;
cmodlxnd30001qxyv77eh7hqv	cmodlxn8v0000qxyv5we750jv	GOOGLE	100716330729219191830	victorsantosyt24@gmail.com	2026-04-25 00:34:48.02
\.


--
-- Data for Name: SafetyEvent; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SafetyEvent" (id, type, "userId", "serviceId", lat, lng, meta, "createdAt") FROM stdin;
\.


--
-- Data for Name: Servico; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Servico" (id, status, tipo, data, turno, cidade, uf, bairro, "enderecoCompleto", observacoes, "temPet", "quartos3Mais", "banheiros2Mais", "precoFinal", "clientId", "diaristaId", "createdAt", "updatedAt", categoria) FROM stdin;
cmkzyle4o00000uyvym0gc66p	CONCLUIDO	FAXINA	2026-02-05 21:21:14.716	MANHA	Cuiabá	MT	Centro	\N	Pedido criado pelo app (MVP).	f	f	f	15000	cmkzmt13f0001cmyv0fnow0ov	cmkzmt2qk0004cmyvq0ixqrmq	2026-01-29 21:21:18.024	2026-01-29 21:22:41.179	FAXINA_LEVE
cml00sxrn0000m4yvbezhbehd	SOLICITADO	BABA	2026-02-05 22:23:07.069	TARDE	Cuiabá	MT	Centro	\N	Pedido criado pelo app (MVP).	f	f	f	16000	cmkzmt13f0001cmyv0fnow0ov	cmkzmt67q000dcmyvwnn79w51	2026-01-29 22:23:09.299	2026-01-29 22:23:09.299	BABA_DIURNA
cml00tb190001m4yvsr93otgw	SOLICITADO	BABA	2026-02-05 22:23:25.597	TARDE	Cuiabá	MT	Centro	\N	Pedido criado pelo app (MVP).	f	f	f	16000	cmkzmt13f0001cmyv0fnow0ov	cmkzmt67q000dcmyvwnn79w51	2026-01-29 22:23:26.493	2026-01-29 22:23:26.493	BABA_DIURNA
\.


--
-- Data for Name: ServicoEvento; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ServicoEvento" (id, "servicoId", "fromStatus", "toStatus", "actorRole", "actorId", "createdAt") FROM stdin;
cmkzylrok00010uyvo0xf2v7c	cmkzyle4o00000uyvym0gc66p	SOLICITADO	ACEITO	DIARISTA	cmkzmt2qk0004cmyvq0ixqrmq	2026-01-29 21:21:35.588
cmkzyn14c00020uyvw11z7nbz	cmkzyle4o00000uyvym0gc66p	ACEITO	EM_ANDAMENTO	DIARISTA	cmkzmt2qk0004cmyvq0ixqrmq	2026-01-29 21:22:34.476
cmkzyn6ey00030uyvvxxa8kuy	cmkzyle4o00000uyvym0gc66p	EM_ANDAMENTO	CONCLUIDO	DIARISTA	cmkzmt2qk0004cmyvq0ixqrmq	2026-01-29 21:22:41.338
\.


--
-- Data for Name: Subscription; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Subscription" (id, "userId", plan, status, "startedAt", "expiresAt", "canceledAt", "externalId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, nome, telefone, email, "senhaHash", role, status, "createdAt", "updatedAt", "avatarUrl", "riskScore", "riskTier", cpf, "dataNascimento", "pushToken") FROM stdin;
seed-cliente-1	Cliente	65999990010	cliente@dular.dev	$2b$10$a0MJzylNj5hvc0onYin52O2vyB1ADx8JvuUnAIOTRt.V0j1Q/dTJe	CLIENTE	ATIVO	2026-01-12 02:06:31.32	2026-01-12 02:06:31.32	\N	0	0	\N	\N	\N
seed-diarista-1	Diarista	65999990011	diarista@dular.dev	$2b$10$uAhgBVA0oeEGI2Ye/Bv8O.ij/7j2kFsinZBCr0u5jo.UaIwBNY6CW	DIARISTA	ATIVO	2026-01-12 02:06:31.32	2026-01-12 02:06:31.32	\N	0	0	\N	\N	\N
seed-admin-1	Admin	65999990000	admin@dular.dev	$2b$10$AfPNXZc1eqTYqj1xxIXQqu3Q95KDvaGnQ.gMkr.2EN6ZnLwIfUzym	ADMIN	ATIVO	2026-01-12 02:06:31.32	2026-01-29 05:57:40.951	data:image/jpeg;base64,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	0	0	\N	\N	\N
cmkzmt13f0001cmyv0fnow0ov	Cliente Teste 1	65999990001	\N	$2b$10$BD2tKB9N19d4TOqBBqlbOe1OLpZaeA/DvBhehmquFeBvwmW552rOm	CLIENTE	ATIVO	2026-01-29 15:51:18.696	2026-01-29 15:51:18.696	\N	0	0	\N	\N	\N
cmkzmt1sa0002cmyva4ask81k	Cliente Teste 2	65999990003	\N	$2b$10$BD2tKB9N19d4TOqBBqlbOe1OLpZaeA/DvBhehmquFeBvwmW552rOm	CLIENTE	ATIVO	2026-01-29 15:51:19.489	2026-01-29 15:51:19.489	\N	0	0	\N	\N	\N
cmkzmt2dd0003cmyv64bdhny7	Cliente Teste 3	65999990004	\N	$2b$10$BD2tKB9N19d4TOqBBqlbOe1OLpZaeA/DvBhehmquFeBvwmW552rOm	CLIENTE	ATIVO	2026-01-29 15:51:20.329	2026-01-29 15:51:20.329	\N	0	0	\N	\N	\N
cmkzmt0p80000cmyv5jx7d18i	Victor Dev	65999990100	victordev.tec@gmail.com	$2b$10$6YFzuQD0j5NyIO6togMNr.pJUMrnbmBVUU8QK.IPhcW2HtIGivVlO	ADMIN	ATIVO	2026-01-29 15:51:18.476	2026-01-29 21:41:27.741	\N	0	0	\N	\N	\N
cmkzmt2qk0004cmyvq0ixqrmq	Mariana Silva	65999990002	\N	$2b$10$yFMAxDSDnDIRvCZPlGU2CeM8jfdOwEsSUqMToOidpnpeyhRlZ9ARG	DIARISTA	ATIVO	2026-01-29 15:51:21.116	2026-01-29 21:41:30.224	\N	0	0	\N	\N	\N
cmkzmt67q000dcmyvwnn79w51	Amanda Costa	65999990005	\N	$2b$10$yFMAxDSDnDIRvCZPlGU2CeM8jfdOwEsSUqMToOidpnpeyhRlZ9ARG	DIARISTA	ATIVO	2026-01-29 15:51:25.622	2026-01-29 21:41:35.635	\N	0	0	\N	\N	\N
cmkzmt8yh000kcmyvdox5wf2u	Carlos Pereira	65999990006	\N	$2b$10$yFMAxDSDnDIRvCZPlGU2CeM8jfdOwEsSUqMToOidpnpeyhRlZ9ARG	DIARISTA	ATIVO	2026-01-29 15:51:29.177	2026-01-29 21:41:41.681	\N	0	0	\N	\N	\N
cmodlxn8v0000qxyv5we750jv	Victor santos Lima	66981309903	victorsantosyt24@gmail.com	\N	DIARISTA	ATIVO	2026-04-25 00:34:48.02	2026-04-28 12:38:55.899	data:image/jpeg;base64,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	0	0	60865457310	1999-11-22 00:00:00	\N
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
b9f08869-906e-4e69-b49d-3482ab3dfb93	2f275026197ba157e8910f7a19ad4830a26b7c0e8a5936fe5624d74f7034c869	2026-01-08 05:42:11.206033+00	20260108054209_diarista_profile_ativo	\N	\N	2026-01-08 05:42:10.462628+00	1
a200b15f-fa02-43eb-85f4-469a11740619	c1e602c36e94d2ea44cb76e4f198257f565bd3f532a85e82d8ea422592788b67	2026-01-08 08:45:40.1616+00	20260108084538_add_servico_evento	\N	\N	2026-01-08 08:45:39.405354+00	1
8d0e7b36-2860-437a-9e72-1b6133a33416	ddd92685699e56656f8394f2fe7241438d7fc2724ff49d0b07524c4117969afb	2026-01-11 14:58:07.460993+00	20250211120000_add_avatar_url		\N	2026-01-11 14:58:07.460993+00	0
0b1815ae-2718-4576-bf45-2fd9a24bdc75	81690772f0ee1025f7c637c896ba35a132d8c8beac2b3e2c224d46e00cfaa97c	2026-01-29 21:32:30.694198+00	20260129180000_add_tags_categories_match		\N	2026-01-29 21:32:30.694198+00	0
559d4057-140b-48ae-81c5-396398dc56c3	d7915b711ee8985c739be2dfda654d7039de7c3c6d9ca5443f311fc939544924	2026-04-24 23:36:41.670488+00	20260424000000_add_chat_subscription_oauth	\N	\N	2026-04-24 23:36:40.879871+00	1
697c2647-87b3-4c30-857b-86bdb2f23e31	96aa051e6dd25f68884f5faf8314491ee2330bc5223963afd6fb9db215e90df7	2026-04-24 23:41:17.101035+00	20260424000001_nullable_user_role	\N	\N	2026-04-24 23:41:16.388888+00	1
c7b4abb0-00fa-4e6d-b66d-0f34710991bc	seed_feature_limits_manual	2026-04-25 16:48:26.37294+00	20260425000000_seed_feature_limits	\N	\N	2026-04-25 16:48:26.37294+00	1
03e99972-d372-4b67-bc2e-4002440552df	add_push_token	2026-04-26 00:29:00.308057+00	20260425010000_add_push_token	\N	\N	2026-04-26 00:29:00.308057+00	1
\.


--
-- Statistics for Name: Avaliacao; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Avaliacao',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Bairro; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Bairro',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: ChatMessage; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'ChatMessage',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: ChatRoom; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'ChatRoom',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: CreditTransaction; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'CreditTransaction',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: CreditWallet; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'CreditWallet',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaBairro; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaBairro',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaHabilidade; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaHabilidade',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaProfile; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaProfile',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Disponibilidade; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Disponibilidade',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: FeatureLimit; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'FeatureLimit',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: IncidentAttachment; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'IncidentAttachment',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: IncidentReport; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'IncidentReport',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: OAuthAccount; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'OAuthAccount',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: SafetyEvent; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'SafetyEvent',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Servico; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Servico',
	'relpages', '1'::integer,
	'reltuples', '1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: ServicoEvento; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'ServicoEvento',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Subscription; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Subscription',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: User; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'relpages', '1'::integer,
	'reltuples', '11'::real,
	'relallvisible', '0'::integer
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'avatarUrl',
	'inherited', 'f'::boolean,
	'null_frac', '0.90909094'::real,
	'avg_width', '18'::integer,
	'n_distinct', '-0.090909064'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'cpf',
	'inherited', 'f'::boolean,
	'null_frac', '0.90909094'::real,
	'avg_width', '12'::integer,
	'n_distinct', '-0.090909064'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'createdAt',
	'inherited', 'f'::boolean,
	'null_frac', '0'::real,
	'avg_width', '8'::integer,
	'n_distinct', '-0.8181818'::real,
	'most_common_vals', '{"2026-01-12 02:06:31.32"}'::text,
	'most_common_freqs', '{0.27272728}'::real[],
	'histogram_bounds', '{"2026-01-29 15:51:18.476","2026-01-29 15:51:18.696","2026-01-29 15:51:19.489","2026-01-29 15:51:20.329","2026-01-29 15:51:21.116","2026-01-29 15:51:25.622","2026-01-29 15:51:29.177","2026-04-25 00:34:48.02"}'::text,
	'correlation', '0.94545454'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'dataNascimento',
	'inherited', 'f'::boolean,
	'null_frac', '0.90909094'::real,
	'avg_width', '8'::integer,
	'n_distinct', '-0.090909064'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'email',
	'inherited', 'f'::boolean,
	'null_frac', '0.54545456'::real,
	'avg_width', '20'::integer,
	'n_distinct', '-0.45454544'::real,
	'histogram_bounds', '{admin@dular.dev,cliente@dular.dev,diarista@dular.dev,victordev.tec@gmail.com,victorsantosyt24@gmail.com}'::text,
	'correlation', '0.7'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'id',
	'inherited', 'f'::boolean,
	'null_frac', '0'::real,
	'avg_width', '22'::integer,
	'n_distinct', '-1'::real,
	'histogram_bounds', '{cmkzmt0p80000cmyv5jx7d18i,cmkzmt13f0001cmyv0fnow0ov,cmkzmt1sa0002cmyva4ask81k,cmkzmt2dd0003cmyv64bdhny7,cmkzmt2qk0004cmyvq0ixqrmq,cmkzmt67q000dcmyvwnn79w51,cmkzmt8yh000kcmyvdox5wf2u,cmodlxn8v0000qxyv5we750jv,seed-admin-1,seed-cliente-1,seed-diarista-1}'::text,
	'correlation', '-0.28181818'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'nome',
	'inherited', 'f'::boolean,
	'null_frac', '0'::real,
	'avg_width', '13'::integer,
	'n_distinct', '-1'::real,
	'histogram_bounds', '{Admin,"Amanda Costa","Carlos Pereira",Cliente,"Cliente Teste 1","Cliente Teste 2","Cliente Teste 3",Diarista,"Mariana Silva","Victor Dev","Victor santos Lima"}'::text,
	'correlation', '0.27272728'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'pushToken',
	'inherited', 'f'::boolean,
	'null_frac', '1'::real,
	'avg_width', '0'::integer,
	'n_distinct', '0'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'riskScore',
	'inherited', 'f'::boolean,
	'null_frac', '0'::real,
	'avg_width', '4'::integer,
	'n_distinct', '1'::real,
	'most_common_vals', '{0}'::text,
	'most_common_freqs', '{1}'::real[],
	'correlation', '1'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'riskTier',
	'inherited', 'f'::boolean,
	'null_frac', '0'::real,
	'avg_width', '4'::integer,
	'n_distinct', '1'::real,
	'most_common_vals', '{0}'::text,
	'most_common_freqs', '{1}'::real[],
	'correlation', '1'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'role',
	'inherited', 'f'::boolean,
	'null_frac', '0'::real,
	'avg_width', '4'::integer,
	'n_distinct', '-0.27272728'::real,
	'most_common_vals', '{CLIENTE,DIARISTA,ADMIN}'::text,
	'most_common_freqs', '{0.45454547,0.36363637,0.18181819}'::real[],
	'correlation', '0.4'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'senhaHash',
	'inherited', 'f'::boolean,
	'null_frac', '0.09090909'::real,
	'avg_width', '61'::integer,
	'n_distinct', '-0.54545456'::real,
	'most_common_vals', '{$2b$10$BD2tKB9N19d4TOqBBqlbOe1OLpZaeA/DvBhehmquFeBvwmW552rOm,$2b$10$yFMAxDSDnDIRvCZPlGU2CeM8jfdOwEsSUqMToOidpnpeyhRlZ9ARG}'::text,
	'most_common_freqs', '{0.27272728,0.27272728}'::real[],
	'histogram_bounds', '{$2b$10$6YFzuQD0j5NyIO6togMNr.pJUMrnbmBVUU8QK.IPhcW2HtIGivVlO,$2b$10$a0MJzylNj5hvc0onYin52O2vyB1ADx8JvuUnAIOTRt.V0j1Q/dTJe,$2b$10$AfPNXZc1eqTYqj1xxIXQqu3Q95KDvaGnQ.gMkr.2EN6ZnLwIfUzym,$2b$10$uAhgBVA0oeEGI2Ye/Bv8O.ij/7j2kFsinZBCr0u5jo.UaIwBNY6CW}'::text,
	'correlation', '0.6242424'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'status',
	'inherited', 'f'::boolean,
	'null_frac', '0'::real,
	'avg_width', '4'::integer,
	'n_distinct', '1'::real,
	'most_common_vals', '{ATIVO}'::text,
	'most_common_freqs', '{1}'::real[],
	'correlation', '1'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'telefone',
	'inherited', 'f'::boolean,
	'null_frac', '0'::real,
	'avg_width', '12'::integer,
	'n_distinct', '-1'::real,
	'histogram_bounds', '{65999990000,65999990001,65999990002,65999990003,65999990004,65999990005,65999990006,65999990010,65999990011,65999990100,66981309903}'::text,
	'correlation', '0.27272728'::real
);
SELECT * FROM pg_catalog.pg_restore_attribute_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User',
	'attname', 'updatedAt',
	'inherited', 'f'::boolean,
	'null_frac', '0'::real,
	'avg_width', '8'::integer,
	'n_distinct', '-0.90909094'::real,
	'most_common_vals', '{"2026-01-12 02:06:31.32"}'::text,
	'most_common_freqs', '{0.18181819}'::real[],
	'histogram_bounds', '{"2026-01-29 05:57:40.951","2026-01-29 15:51:18.696","2026-01-29 15:51:19.489","2026-01-29 15:51:20.329","2026-01-29 21:41:27.741","2026-01-29 21:41:30.224","2026-01-29 21:41:35.635","2026-01-29 21:41:41.681","2026-04-26 15:29:07.866"}'::text,
	'correlation', '1'::real
);


--
-- Statistics for Name: _prisma_migrations; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', '_prisma_migrations',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Name: Avaliacao_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Avaliacao_clientId_idx" ON public."Avaliacao" USING btree ("clientId");


--
-- Name: Avaliacao_diaristaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Avaliacao_diaristaId_idx" ON public."Avaliacao" USING btree ("diaristaId");


--
-- Name: Avaliacao Avaliacao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Avaliacao"
    ADD CONSTRAINT "Avaliacao_pkey" PRIMARY KEY (id);


--
-- Name: Avaliacao_servicoId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Avaliacao_servicoId_key" ON public."Avaliacao" USING btree ("servicoId");


--
-- Name: Bairro_cidade_uf_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Bairro_cidade_uf_idx" ON public."Bairro" USING btree (cidade, uf);


--
-- Name: Bairro_nome_cidade_uf_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Bairro_nome_cidade_uf_key" ON public."Bairro" USING btree (nome, cidade, uf);


--
-- Name: Bairro Bairro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Bairro"
    ADD CONSTRAINT "Bairro_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessage ChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessage_roomId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON public."ChatMessage" USING btree ("roomId", "createdAt");


--
-- Name: ChatMessage_senderId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ChatMessage_senderId_idx" ON public."ChatMessage" USING btree ("senderId");


--
-- Name: ChatRoom ChatRoom_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ChatRoom"
    ADD CONSTRAINT "ChatRoom_pkey" PRIMARY KEY (id);


--
-- Name: ChatRoom_servicoId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ChatRoom_servicoId_key" ON public."ChatRoom" USING btree ("servicoId");


--
-- Name: CreditTransaction CreditTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CreditTransaction"
    ADD CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY (id);


--
-- Name: CreditTransaction_servicoId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "CreditTransaction_servicoId_idx" ON public."CreditTransaction" USING btree ("servicoId");


--
-- Name: CreditTransaction_walletId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "CreditTransaction_walletId_idx" ON public."CreditTransaction" USING btree ("walletId");


--
-- Name: CreditWallet CreditWallet_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CreditWallet"
    ADD CONSTRAINT "CreditWallet_pkey" PRIMARY KEY (id);


--
-- Name: CreditWallet_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "CreditWallet_userId_key" ON public."CreditWallet" USING btree ("userId");


--
-- Name: DiaristaBairro_bairroId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DiaristaBairro_bairroId_idx" ON public."DiaristaBairro" USING btree ("bairroId");


--
-- Name: DiaristaBairro_diaristaId_bairroId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "DiaristaBairro_diaristaId_bairroId_key" ON public."DiaristaBairro" USING btree ("diaristaId", "bairroId");


--
-- Name: DiaristaBairro_diaristaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DiaristaBairro_diaristaId_idx" ON public."DiaristaBairro" USING btree ("diaristaId");


--
-- Name: DiaristaBairro DiaristaBairro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiaristaBairro"
    ADD CONSTRAINT "DiaristaBairro_pkey" PRIMARY KEY (id);


--
-- Name: DiaristaHabilidade_diaristaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DiaristaHabilidade_diaristaId_idx" ON public."DiaristaHabilidade" USING btree ("diaristaId");


--
-- Name: DiaristaHabilidade_diaristaId_tipo_categoria_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "DiaristaHabilidade_diaristaId_tipo_categoria_key" ON public."DiaristaHabilidade" USING btree ("diaristaId", tipo, categoria);


--
-- Name: DiaristaHabilidade DiaristaHabilidade_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiaristaHabilidade"
    ADD CONSTRAINT "DiaristaHabilidade_pkey" PRIMARY KEY (id);


--
-- Name: DiaristaHabilidade_tipo_categoria_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DiaristaHabilidade_tipo_categoria_idx" ON public."DiaristaHabilidade" USING btree (tipo, categoria);


--
-- Name: DiaristaProfile DiaristaProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiaristaProfile"
    ADD CONSTRAINT "DiaristaProfile_pkey" PRIMARY KEY (id);


--
-- Name: DiaristaProfile_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "DiaristaProfile_userId_key" ON public."DiaristaProfile" USING btree ("userId");


--
-- Name: Disponibilidade_diaristaId_diaSemana_turno_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Disponibilidade_diaristaId_diaSemana_turno_key" ON public."Disponibilidade" USING btree ("diaristaId", "diaSemana", turno);


--
-- Name: Disponibilidade_diaristaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Disponibilidade_diaristaId_idx" ON public."Disponibilidade" USING btree ("diaristaId");


--
-- Name: Disponibilidade Disponibilidade_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Disponibilidade"
    ADD CONSTRAINT "Disponibilidade_pkey" PRIMARY KEY (id);


--
-- Name: FeatureLimit FeatureLimit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."FeatureLimit"
    ADD CONSTRAINT "FeatureLimit_pkey" PRIMARY KEY (id);


--
-- Name: FeatureLimit_plan_feature_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "FeatureLimit_plan_feature_key" ON public."FeatureLimit" USING btree (plan, feature);


--
-- Name: IncidentAttachment_incidentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IncidentAttachment_incidentId_idx" ON public."IncidentAttachment" USING btree ("incidentId");


--
-- Name: IncidentAttachment IncidentAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."IncidentAttachment"
    ADD CONSTRAINT "IncidentAttachment_pkey" PRIMARY KEY (id);


--
-- Name: IncidentReport IncidentReport_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."IncidentReport"
    ADD CONSTRAINT "IncidentReport_pkey" PRIMARY KEY (id);


--
-- Name: IncidentReport_reportedUserId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IncidentReport_reportedUserId_idx" ON public."IncidentReport" USING btree ("reportedUserId");


--
-- Name: IncidentReport_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IncidentReport_status_idx" ON public."IncidentReport" USING btree (status);


--
-- Name: OAuthAccount OAuthAccount_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OAuthAccount"
    ADD CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY (id);


--
-- Name: OAuthAccount_provider_providerId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "OAuthAccount_provider_providerId_key" ON public."OAuthAccount" USING btree (provider, "providerId");


--
-- Name: OAuthAccount_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "OAuthAccount_userId_idx" ON public."OAuthAccount" USING btree ("userId");


--
-- Name: SafetyEvent SafetyEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SafetyEvent"
    ADD CONSTRAINT "SafetyEvent_pkey" PRIMARY KEY (id);


--
-- Name: ServicoEvento_actorId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ServicoEvento_actorId_idx" ON public."ServicoEvento" USING btree ("actorId");


--
-- Name: ServicoEvento ServicoEvento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServicoEvento"
    ADD CONSTRAINT "ServicoEvento_pkey" PRIMARY KEY (id);


--
-- Name: ServicoEvento_servicoId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ServicoEvento_servicoId_idx" ON public."ServicoEvento" USING btree ("servicoId");


--
-- Name: Servico_cidade_uf_bairro_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Servico_cidade_uf_bairro_idx" ON public."Servico" USING btree (cidade, uf, bairro);


--
-- Name: Servico_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Servico_clientId_idx" ON public."Servico" USING btree ("clientId");


--
-- Name: Servico_data_turno_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Servico_data_turno_idx" ON public."Servico" USING btree (data, turno);


--
-- Name: Servico_diaristaId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Servico_diaristaId_idx" ON public."Servico" USING btree ("diaristaId");


--
-- Name: Servico Servico_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Servico"
    ADD CONSTRAINT "Servico_pkey" PRIMARY KEY (id);


--
-- Name: Servico_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Servico_status_idx" ON public."Servico" USING btree (status);


--
-- Name: Subscription Subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY (id);


--
-- Name: Subscription_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Subscription_status_idx" ON public."Subscription" USING btree (status);


--
-- Name: Subscription_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Subscription_userId_key" ON public."Subscription" USING btree ("userId");


--
-- Name: User_cpf_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_cpf_key" ON public."User" USING btree (cpf);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: User_telefone_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_telefone_key" ON public."User" USING btree (telefone);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Avaliacao Avaliacao_servicoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Avaliacao"
    ADD CONSTRAINT "Avaliacao_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES public."Servico"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatMessage ChatMessage_roomId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES public."ChatRoom"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatMessage ChatMessage_senderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ChatRoom ChatRoom_servicoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ChatRoom"
    ADD CONSTRAINT "ChatRoom_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES public."Servico"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CreditTransaction CreditTransaction_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CreditTransaction"
    ADD CONSTRAINT "CreditTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."CreditWallet"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CreditWallet CreditWallet_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CreditWallet"
    ADD CONSTRAINT "CreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DiaristaBairro DiaristaBairro_bairroId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiaristaBairro"
    ADD CONSTRAINT "DiaristaBairro_bairroId_fkey" FOREIGN KEY ("bairroId") REFERENCES public."Bairro"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DiaristaBairro DiaristaBairro_diaristaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiaristaBairro"
    ADD CONSTRAINT "DiaristaBairro_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES public."DiaristaProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DiaristaHabilidade DiaristaHabilidade_diaristaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiaristaHabilidade"
    ADD CONSTRAINT "DiaristaHabilidade_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DiaristaProfile DiaristaProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiaristaProfile"
    ADD CONSTRAINT "DiaristaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Disponibilidade Disponibilidade_diaristaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Disponibilidade"
    ADD CONSTRAINT "Disponibilidade_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES public."DiaristaProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IncidentAttachment IncidentAttachment_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."IncidentAttachment"
    ADD CONSTRAINT "IncidentAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public."IncidentReport"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IncidentReport IncidentReport_reportedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."IncidentReport"
    ADD CONSTRAINT "IncidentReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: IncidentReport IncidentReport_reportedUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."IncidentReport"
    ADD CONSTRAINT "IncidentReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OAuthAccount OAuthAccount_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OAuthAccount"
    ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SafetyEvent SafetyEvent_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SafetyEvent"
    ADD CONSTRAINT "SafetyEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServicoEvento ServicoEvento_servicoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServicoEvento"
    ADD CONSTRAINT "ServicoEvento_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES public."Servico"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Servico Servico_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Servico"
    ADD CONSTRAINT "Servico_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Servico Servico_diaristaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Servico"
    ADD CONSTRAINT "Servico_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Subscription Subscription_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Statistics for Name: Avaliacao_clientId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Avaliacao_clientId_idx',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Avaliacao_diaristaId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Avaliacao_diaristaId_idx',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Avaliacao_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Avaliacao_pkey',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Avaliacao_servicoId_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Avaliacao_servicoId_key',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Bairro_cidade_uf_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Bairro_cidade_uf_idx',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Bairro_nome_cidade_uf_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Bairro_nome_cidade_uf_key',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Bairro_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Bairro_pkey',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: ChatMessage_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'ChatMessage_pkey',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: ChatMessage_roomId_createdAt_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'ChatMessage_roomId_createdAt_idx',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: ChatMessage_senderId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'ChatMessage_senderId_idx',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: ChatRoom_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'ChatRoom_pkey',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: ChatRoom_servicoId_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'ChatRoom_servicoId_key',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: CreditTransaction_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'CreditTransaction_pkey',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: CreditTransaction_servicoId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'CreditTransaction_servicoId_idx',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: CreditTransaction_walletId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'CreditTransaction_walletId_idx',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: CreditWallet_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'CreditWallet_pkey',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: CreditWallet_userId_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'CreditWallet_userId_key',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaBairro_bairroId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaBairro_bairroId_idx',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaBairro_diaristaId_bairroId_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaBairro_diaristaId_bairroId_key',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaBairro_diaristaId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaBairro_diaristaId_idx',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaBairro_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaBairro_pkey',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaHabilidade_diaristaId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaHabilidade_diaristaId_idx',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaHabilidade_diaristaId_tipo_categoria_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaHabilidade_diaristaId_tipo_categoria_key',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaHabilidade_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaHabilidade_pkey',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaHabilidade_tipo_categoria_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaHabilidade_tipo_categoria_idx',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaProfile_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaProfile_pkey',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: DiaristaProfile_userId_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'DiaristaProfile_userId_key',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Disponibilidade_diaristaId_diaSemana_turno_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Disponibilidade_diaristaId_diaSemana_turno_key',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Disponibilidade_diaristaId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Disponibilidade_diaristaId_idx',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Disponibilidade_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Disponibilidade_pkey',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: FeatureLimit_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'FeatureLimit_pkey',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: FeatureLimit_plan_feature_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'FeatureLimit_plan_feature_key',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: IncidentAttachment_incidentId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'IncidentAttachment_incidentId_idx',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: IncidentAttachment_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'IncidentAttachment_pkey',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: IncidentReport_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'IncidentReport_pkey',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: IncidentReport_reportedUserId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'IncidentReport_reportedUserId_idx',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: IncidentReport_status_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'IncidentReport_status_idx',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: OAuthAccount_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'OAuthAccount_pkey',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: OAuthAccount_provider_providerId_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'OAuthAccount_provider_providerId_key',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: OAuthAccount_userId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'OAuthAccount_userId_idx',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: SafetyEvent_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'SafetyEvent_pkey',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: ServicoEvento_actorId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'ServicoEvento_actorId_idx',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: ServicoEvento_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'ServicoEvento_pkey',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: ServicoEvento_servicoId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'ServicoEvento_servicoId_idx',
	'relpages', '0'::integer,
	'reltuples', '-1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Servico_cidade_uf_bairro_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Servico_cidade_uf_bairro_idx',
	'relpages', '2'::integer,
	'reltuples', '1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Servico_clientId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Servico_clientId_idx',
	'relpages', '2'::integer,
	'reltuples', '1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Servico_data_turno_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Servico_data_turno_idx',
	'relpages', '2'::integer,
	'reltuples', '1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Servico_diaristaId_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Servico_diaristaId_idx',
	'relpages', '2'::integer,
	'reltuples', '1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Servico_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Servico_pkey',
	'relpages', '2'::integer,
	'reltuples', '1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Servico_status_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Servico_status_idx',
	'relpages', '2'::integer,
	'reltuples', '1'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Subscription_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Subscription_pkey',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Subscription_status_idx; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Subscription_status_idx',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: Subscription_userId_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'Subscription_userId_key',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: User_cpf_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User_cpf_key',
	'relpages', '2'::integer,
	'reltuples', '11'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: User_email_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User_email_key',
	'relpages', '2'::integer,
	'reltuples', '11'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: User_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User_pkey',
	'relpages', '2'::integer,
	'reltuples', '11'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: User_telefone_key; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', 'User_telefone_key',
	'relpages', '2'::integer,
	'reltuples', '11'::real,
	'relallvisible', '0'::integer
);


--
-- Statistics for Name: _prisma_migrations_pkey; Type: STATISTICS DATA; Schema: public; Owner: -
--

SELECT * FROM pg_catalog.pg_restore_relation_stats(
	'version', '170007'::integer,
	'schemaname', 'public',
	'relname', '_prisma_migrations_pkey',
	'relpages', '1'::integer,
	'reltuples', '0'::real,
	'relallvisible', '0'::integer
);


--
-- PostgreSQL database dump complete
--

