create table dataset_lift_snapshots (
  id serial primary key,
  computed_at timestamptz default now(),
  n_contributions int not null,
  n_held_out_scenarios int not null,
  base_haiku_mean real not null,
  dataset_haiku_mean real not null,
  lift real not null,
  details jsonb not null,
  judge_model text not null default 'claude-sonnet-4-6',
  student_model text not null default 'claude-haiku-4-5-20251001'
);

alter table dataset_lift_snapshots enable row level security;
