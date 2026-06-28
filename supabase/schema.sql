-- Wisp schema (namespaced with wisp_ to avoid clashing with other apps in the same project).
-- The server stores public keys and ciphertext only. Never plaintext or private keys.

create table if not exists wisp_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text,
  public_key jsonb not null,
  created_at timestamptz default now()
);

create table if not exists wisp_conversations (
  id uuid primary key default gen_random_uuid(),
  dm_key text unique,
  created_at timestamptz default now()
);

create table if not exists wisp_members (
  conversation_id uuid references wisp_conversations(id) on delete cascade,
  user_id uuid references wisp_profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table if not exists wisp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references wisp_conversations(id) on delete cascade,
  sender_id uuid references wisp_profiles(id) on delete cascade,
  iv text not null,
  ciphertext text not null,
  created_at timestamptz default now()
);
create index if not exists wisp_messages_convo_idx on wisp_messages(conversation_id, created_at);

alter table wisp_profiles enable row level security;
alter table wisp_conversations enable row level security;
alter table wisp_members enable row level security;
alter table wisp_messages enable row level security;

create policy "wisp profiles readable" on wisp_profiles for select using (true);
create policy "wisp own profile" on wisp_profiles for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "wisp convo insert" on wisp_conversations for insert to authenticated with check (true);
create policy "wisp convo read" on wisp_conversations for select using (
  exists (select 1 from wisp_members m where m.conversation_id = id and m.user_id = auth.uid())
);

create policy "wisp member insert" on wisp_members for insert to authenticated with check (true);
create policy "wisp member read" on wisp_members for select using (user_id = auth.uid());

create policy "wisp messages read" on wisp_messages for select using (
  exists (select 1 from wisp_members m where m.conversation_id = wisp_messages.conversation_id and m.user_id = auth.uid())
);
create policy "wisp messages send" on wisp_messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from wisp_members m where m.conversation_id = wisp_messages.conversation_id and m.user_id = auth.uid()
  )
);

alter publication supabase_realtime add table wisp_messages;