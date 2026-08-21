-- ═══════════════════════════════════════════════════════════════════════
--  QuantumCall bridge v2 — Phase A : les 4 tables du PIPELINE VIVANT.
--  À exécuter dans le SQL editor du projet Supabase QuantumCall (eu-west-3).
--
--  RLS : anon = LECTURE SEULE (le front). Le bridge écrit avec la clé
--  service_role, qui CONTOURNE RLS — aucune policy d'écriture pour anon,
--  donc le front ne peut jamais écrire.
--
--  DEVISE : on stocke TOUJOURS la valeur du broker AVEC son label de devise,
--  jamais une valeur convertie. La conversion (base CHF → affichage USD) se
--  fait à l'affichage via la source FX unique. Une valeur convertie en base
--  serait une seconde source de vérité.
--
--  HORODATAGE : chaque table porte son instant de capture. position_marks
--  porte l'horodatage DU MARK (non négociable) — la fraîcheur se juge par
--  mark, pas au niveau du feed.
-- ═══════════════════════════════════════════════════════════════════════

-- ── nlv_snapshots — NLV, cash, cash réglé, devise ──────────────────────
create table if not exists public.nlv_snapshots (
  id           bigint generated always as identity primary key,
  captured_at  timestamptz not null,
  nlv          numeric,
  total_cash   numeric,
  -- SettledCash : le non-réglé = total_cash - settled_cash (contrainte T+1 de
  -- la carte, C10) — alimente la cellule NON RÉGLÉ · J+1 restée sans source.
  settled_cash numeric,
  currency     text,
  source       text        not null default 'bridge-v2',
  inserted_at  timestamptz not null default now()
);
create index if not exists nlv_snapshots_captured_at_idx
  on public.nlv_snapshots (captured_at desc);

-- ── account_state — marge, liquidités, cushion ─────────────────────────
-- (installation neuve : inclut available_funds ; base existante : migration
--  sql/001_account_state_available_funds.sql — create if not exists ne
--  modifie pas une table déjà créée.)
create table if not exists public.account_state (
  id               bigint generated always as identity primary key,
  captured_at      timestamptz not null,
  maint_margin     numeric,
  excess_liquidity numeric,
  buying_power     numeric,
  available_funds  numeric,       -- fonds après marge initiale (migration 001)
  cushion          numeric,       -- ratio [0–1], sans devise
  currency         text,
  source           text        not null default 'bridge-v2',
  inserted_at      timestamptz not null default now()
);
create index if not exists account_state_captured_at_idx
  on public.account_state (captured_at desc);

-- ── position_marks — mark daté par position ────────────────────────────
create table if not exists public.position_marks (
  id          bigint generated always as identity primary key,
  -- EXACTEMENT positionSignature du client : tk|as|dir|ty|st|ex. Alimente le
  -- même pic que Q-C (qc:positionMarks) sans réconciliation.
  signature   text        not null,
  mid         numeric,
  mark_at     timestamptz not null,   -- horodatage DU MARK (non négociable)
  source      text        not null,   -- 'pnlSingle' | 'ticker'
  conid       text,
  currency    text,
  unrealized  numeric,
  inserted_at timestamptz not null default now()
);
create index if not exists position_marks_sig_idx
  on public.position_marks (signature, mark_at desc);

-- ── fx_rates — mid IDEALPRO daté ───────────────────────────────────────
create table if not exists public.fx_rates (
  id          bigint generated always as identity primary key,
  pair        text        not null,   -- ex. 'USD.CHF'
  mid         numeric,
  captured_at timestamptz not null,
  source      text        not null default 'idealpro',
  inserted_at timestamptz not null default now()
);
create index if not exists fx_rates_pair_idx
  on public.fx_rates (pair, captured_at desc);

-- ── RLS : lecture seule pour anon, écriture réservée au bridge ──────────
alter table public.nlv_snapshots  enable row level security;
alter table public.account_state  enable row level security;
alter table public.position_marks enable row level security;
alter table public.fx_rates       enable row level security;

-- SELECT ouvert (front, clé anon). AUCUNE policy insert/update/delete →
-- anon ne peut pas écrire. service_role (bridge) contourne RLS.
create policy "read nlv"   on public.nlv_snapshots  for select using (true);
create policy "read state" on public.account_state  for select using (true);
create policy "read marks" on public.position_marks for select using (true);
create policy "read fx"    on public.fx_rates        for select using (true);

-- ── Realtime (Phase B) : publier les 4 tables sur le canal supabase_realtime.
alter publication supabase_realtime add table
  public.nlv_snapshots,
  public.account_state,
  public.position_marks,
  public.fx_rates;
