-- Wisp Phase 2 schema.
-- The server stores public keys and ciphertext only. It never sees plaintext or private keys.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text,
  public_key jsonb not null,          -- the user's ECDH public key (JWK). Private key stays on device.
  created_at timestamptz default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

create table if not exists conversation_members (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade,
  iv text not null,                   -- AES-GCM IV (base64)
  ciphertext text not null,           -- encrypted body (base64). Server cannot read this.
  created_at timestamptz default now()
);

create index if not exists messages_convo_idx on messages(conversation_id, created_at);

-- Row Level Security: members can only touch their own conversations.
alter table profiles enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;

create policy "profiles are readable" on profiles for select using (true);
create policy "users manage own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "members read messages" on messages for select
  using (exists (select 1 from conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()));
create policy "members send messages" on messages for insert
  with check (sender_id = auth.uid() and exists (select 1 from conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()));
