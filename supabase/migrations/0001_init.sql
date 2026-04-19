create extension if not exists "uuid-ossp";

create table experts (
  id uuid primary key default uuid_generate_v4(),
  invite_token text unique not null,
  name text,
  background text,
  consent_at timestamptz,
  screener_passed boolean,
  screener_mad real,
  created_at timestamptz default now()
);

create table scenarios (
  id serial primary key,
  prompt text not null,
  metadata jsonb default '{}'::jsonb
);

create table responses (
  id serial primary key,
  scenario_id int references scenarios(id) on delete cascade,
  model text not null,
  text text not null
);

create table labels (
  id serial primary key,
  expert_id uuid references experts(id) on delete cascade,
  response_id int references responses(id) on delete cascade,
  accountability int check (accountability between 1 and 5),
  specificity int check (specificity between 1 and 5),
  warmth int check (warmth between 1 and 5),
  reasoning text,
  submitted_at timestamptz default now(),
  unique (expert_id, response_id)
);

create table screener_questions (
  id serial primary key,
  prompt text not null,
  emotions jsonb not null,
  reference_intensities jsonb not null
);

create table screener_answers (
  id serial primary key,
  expert_id uuid references experts(id) on delete cascade,
  question_id int references screener_questions(id) on delete cascade,
  predicted_intensities jsonb not null,
  abs_deviation real not null,
  unique (expert_id, question_id)
);

create table assignments (
  id serial primary key,
  expert_id uuid references experts(id) on delete cascade,
  scenario_id int references scenarios(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique (expert_id, scenario_id)
);

create index labels_expert_idx on labels(expert_id);
create index labels_response_idx on labels(response_id);
create index responses_scenario_idx on responses(scenario_id);
create index assignments_expert_idx on assignments(expert_id);
create index assignments_scenario_idx on assignments(scenario_id);
