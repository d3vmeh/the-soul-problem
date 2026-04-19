-- Per-scenario "lift" snapshot. Compares a student model (Haiku) across three conditions:
--   1. base       - student response, no examples
--   2. own        - student given just the user's response as an example
--   3. dataset    - student given the full public human-contribution dataset as examples
-- Each is judged by the same judge (Sonnet) and recorded.
create table dataset_lift_snapshots (
  id serial primary key,
  scenario_id int references scenarios(id) on delete cascade,
  user_response_id int references responses(id) on delete set null,
  computed_at timestamptz default now(),
  n_dataset_examples int not null,
  base_score real not null,
  own_score real,           -- nullable: if no user response provided, skip this condition
  dataset_score real not null,
  base_text text not null,
  own_text text,
  dataset_text text not null,
  judge_model text not null default 'claude-sonnet-4-6',
  student_model text not null default 'claude-haiku-4-5-20251001',
  -- Cache by (scenario_id, user_response_id). If user_response_id is null, it's a dataset-only comparison.
  unique (scenario_id, user_response_id)
);

create index dataset_lift_scenario_idx on dataset_lift_snapshots(scenario_id);
create index dataset_lift_user_response_idx on dataset_lift_snapshots(user_response_id);

alter table dataset_lift_snapshots enable row level security;
