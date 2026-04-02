#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl = process.env.QA_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const hostname = new URL(supabaseUrl).hostname;
const isLocalSupabase =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "0.0.0.0";

if (!isLocalSupabase && process.env.QA_FIXTURE_ALLOW_REMOTE !== "1") {
  console.error(
    `Refusing to seed QA state fixture against non-local Supabase host (${hostname}). Set QA_FIXTURE_ALLOW_REMOTE=1 to override.`
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STARTER_IDS = [
  "courtois_01",
  "theo_01",
  "vandijk_01",
  "dias_01",
  "hakimi_01",
  "rodri_01",
  "bellingham_01",
  "odegaard_01",
  "vinicius_01",
  "haaland_01",
  "salah_01",
];

const BENCH_IDS = [
  "alisson_01",
  "robertson_01",
  "saliba_01",
  "frimpong_01",
  "debruyne_01",
  "valverde_01",
  "mbappe_01",
  "saka_01",
  "kane_01",
  "lautaro_01",
];

const DRAFT_POOL = [
  "courtois_01",
  "alisson_01",
  "theo_01",
  "robertson_01",
  "vandijk_01",
  "dias_01",
  "saliba_01",
  "hakimi_01",
  "frimpong_01",
  "rodri_01",
  "bellingham_01",
  "debruyne_01",
  "odegaard_01",
  "valverde_01",
  "vinicius_01",
  "mbappe_01",
  "saka_01",
  "salah_01",
  "foden_01",
  "haaland_01",
  "kane_01",
  "lautaro_01",
  "isak_01",
  "alvarez_01",
  "wirtz_01",
  "pedri_01",
  "rice_01",
  "barella_01",
  "leao_01",
  "son_01",
];

const COMPLETED_DRAFT_PICK_IDS = [
  "vinicius_01",
  "saka_01",
  "rodri_01",
  "haaland_01",
  "courtois_01",
  "debruyne_01",
  "theo_01",
  "salah_01",
  "vandijk_01",
  "mbappe_01",
  "hakimi_01",
  "bellingham_01",
  "dias_01",
  "lautaro_01",
  "odegaard_01",
  "robertson_01",
  "frimpong_01",
  "valverde_01",
  "alisson_01",
  "kane_01",
  "saliba_01",
  "foden_01",
];

const inviteCodes = {
  bringSquadPending: "S107SQD1",
  liveDraftPending: "S107DRP1",
  waitingDraft: "S107WAIT",
  activeTurnDraft: "S107ACTV",
  opponentTurnDraft: "S107OPPO",
  completedDraft: "S107DONE",
};

const fixtureAccounts = [
  {
    email: process.env.QA_FIXTURE_HOST_EMAIL ?? "qa.spoa107.host@example.com",
    password: process.env.QA_FIXTURE_HOST_PASSWORD ?? "SPOA107-host-local-only",
    username: process.env.QA_FIXTURE_HOST_USERNAME ?? "qa_spoa107_host",
    clubName: process.env.QA_FIXTURE_HOST_CLUB_NAME ?? "QA SPOA 107 Host FC",
    managerName: process.env.QA_FIXTURE_HOST_MANAGER_NAME ?? "QA Host Manager",
    favoriteTeam: process.env.QA_FIXTURE_HOST_FAVORITE_TEAM ?? "Test United",
  },
  {
    email: process.env.QA_FIXTURE_GUEST_EMAIL ?? "qa.spoa107.guest@example.com",
    password: process.env.QA_FIXTURE_GUEST_PASSWORD ?? "SPOA107-guest-local-only",
    username: process.env.QA_FIXTURE_GUEST_USERNAME ?? "qa_spoa107_guest",
    clubName: process.env.QA_FIXTURE_GUEST_CLUB_NAME ?? "QA SPOA 107 Guest FC",
    managerName: process.env.QA_FIXTURE_GUEST_MANAGER_NAME ?? "QA Guest Manager",
    favoriteTeam: process.env.QA_FIXTURE_GUEST_FAVORITE_TEAM ?? "Mock City",
  },
];

async function findUserByEmail(email) {
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) throw error;

    const users = data?.users ?? [];
    const found = users.find((candidate) => candidate.email === email);
    if (found) return found;

    if (users.length < 200) return null;
    page += 1;
  }
}

function parseMissingColumnFromError(error) {
  if (!error || error.code !== "PGRST204") return null;
  const match = /Could not find the '([^']+)' column/i.exec(error.message ?? "");
  return match?.[1] ?? null;
}

async function upsertWithMissingColumnFallback(table, payload, onConflict) {
  while (true) {
    const { error } = await admin.from(table).upsert(payload, { onConflict });
    if (!error) return payload;

    const missingColumn = parseMissingColumnFromError(error);
    if (!missingColumn || !(missingColumn in payload)) {
      throw error;
    }

    delete payload[missingColumn];
  }
}

async function insertSingleWithMissingColumnFallback(table, payload) {
  while (true) {
    const { data, error } = await admin
      .from(table)
      .insert(payload)
      .select("*")
      .single();

    if (!error && data) {
      return data;
    }

    const missingColumn = parseMissingColumnFromError(error);
    if (!missingColumn || !(missingColumn in payload)) {
      throw error ?? new Error(`Failed to insert ${table} row`);
    }

    delete payload[missingColumn];
  }
}

async function upsertProfileWithSchemaFallback(profile) {
  const payload = {
    id: profile.id,
    username: profile.username,
    club_name: profile.clubName,
    onboarding_completed: true,
    manager_name: profile.managerName,
    age: 29,
    favorite_team: profile.favoriteTeam,
    manager_avatar_archetype: "Tactician",
    manager_hair_style: "Short",
    manager_hair_color: "Brown",
    manager_skin_tone: "Medium",
    manager_beard_style: "Clean",
    account_status: "active",
    paused_at: null,
    deactivated_at: null,
    squad_locked: true,
    ranked_matches_in_cycle: 0,
    transfers_remaining: 2,
    squad_confirmed_at: new Date().toISOString(),
    cycle_id: 1,
    division: 10,
    division_points: 0,
    elo_rating: 1000,
    coins: 500,
    wins: 0,
    draws: 0,
    losses: 0,
    current_streak: 0,
    best_streak: 0,
    division_wins: 0,
    division_draws: 0,
    division_losses: 0,
    division_season: 1,
    division_matches_played: 0,
    updated_at: new Date().toISOString(),
  };

  while (true) {
    const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" });
    if (!error) return;

    const missingColumn = parseMissingColumnFromError(error);
    if (!missingColumn || !(missingColumn in payload)) {
      throw error;
    }

    delete payload[missingColumn];
  }
}

async function ensureUser(account) {
  const existing = await findUserByEmail(account.email);
  let userId;

  if (existing) {
    userId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      password: account.password,
      user_metadata: {
        username: account.username,
        club_name: account.clubName,
      },
    });

    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        username: account.username,
        club_name: account.clubName,
      },
    });

    if (error) throw error;
    if (!data.user) {
      throw new Error(`Supabase did not return created user for ${account.email}`);
    }

    userId = data.user.id;
  }

  await upsertProfileWithSchemaFallback({ ...account, id: userId });

  const squadPayload = {
    user_id: userId,
    formation: "4-3-3",
    player_ids: STARTER_IDS,
    bench_ids: BENCH_IDS,
    captain_id: "haaland_01",
    total_cost: 0,
    updated_at: new Date().toISOString(),
  };

  await upsertWithMissingColumnFallback("squads", squadPayload, "user_id");

  const tacticsPayload = {
    user_id: userId,
    formation: "4-3-3",
    mentality: "Balanced",
    tempo: "Normal",
    pressing: "Medium",
    width: "Normal",
    ht_if_losing_formation: "4-3-3",
    ht_if_losing_mentality: "Attacking",
    ht_if_winning_mentality: "Defensive",
    updated_at: new Date().toISOString(),
  };

  await upsertWithMissingColumnFallback("tactics", tacticsPayload, "user_id");

  const { error: loginError } = await anon.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (loginError) throw loginError;

  return { ...account, id: userId };
}

async function cleanupExistingState(userIds) {
  const { data: drafts, error: draftListError } = await admin
    .from("draft_sessions")
    .select("id")
    .or(`user_a.in.(${userIds.join(",")}),user_b.in.(${userIds.join(",")})`);
  if (draftListError) throw draftListError;

  if ((drafts ?? []).length > 0) {
    const { error: draftDeleteError } = await admin
      .from("draft_sessions")
      .delete()
      .in("id", drafts.map((draft) => draft.id));
    if (draftDeleteError) throw draftDeleteError;
  }

  const { data: invites, error: inviteListError } = await admin
    .from("friend_invites")
    .select("id")
    .or(`from_user_id.in.(${userIds.join(",")}),to_user_id.in.(${userIds.join(",")})`);
  if (inviteListError) throw inviteListError;

  if ((invites ?? []).length > 0) {
    const { error: inviteDeleteError } = await admin
      .from("friend_invites")
      .delete()
      .in("id", invites.map((invite) => invite.id));
    if (inviteDeleteError) throw inviteDeleteError;
  }
}

async function createInvite({ fromUserId, toUserId = null, mode, status, inviteCode }) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString();
  const payload = {
    from_user_id: fromUserId,
    to_user_id: toUserId,
    mode,
    status,
    invite_code: inviteCode,
    expires_at: expiresAt,
  };

  return insertSingleWithMissingColumnFallback("friend_invites", payload);
}

function pickerForPick(pickNumber, hostId, guestId) {
  if (pickNumber <= 1) return hostId;
  const pairIndexFromPickTwo = Math.floor((pickNumber - 2) / 2);
  return pairIndexFromPickTwo % 2 === 0 ? guestId : hostId;
}

function buildCompletedPicks(hostId, guestId) {
  return COMPLETED_DRAFT_PICK_IDS.map((playerId, index) => ({
    user_id: pickerForPick(index + 1, hostId, guestId),
    player_id: playerId,
    pick_number: index + 1,
  }));
}

async function createDraftSession(payload) {
  return insertSingleWithMissingColumnFallback("draft_sessions", payload);
}

function printAccount(label, account) {
  console.log(`${label}_email=${account.email}`);
  console.log(`${label}_password=${account.password}`);
  console.log(`${label}_username=${account.username}`);
  console.log(`${label}_user_id=${account.id}`);
}

async function main() {
  const [host, guest] = await Promise.all(fixtureAccounts.map(ensureUser));
  await cleanupExistingState([host.id, guest.id]);

  const pendingBringSquadInvite = await createInvite({
    fromUserId: host.id,
    mode: "bring_squad",
    status: "pending",
    inviteCode: inviteCodes.bringSquadPending,
  });

  const pendingLiveDraftInvite = await createInvite({
    fromUserId: host.id,
    mode: "live_draft",
    status: "pending",
    inviteCode: inviteCodes.liveDraftPending,
  });

  const waitingDraftInvite = await createInvite({
    fromUserId: host.id,
    toUserId: guest.id,
    mode: "live_draft",
    status: "accepted",
    inviteCode: inviteCodes.waitingDraft,
  });

  const activeTurnDraftInvite = await createInvite({
    fromUserId: host.id,
    toUserId: guest.id,
    mode: "live_draft",
    status: "accepted",
    inviteCode: inviteCodes.activeTurnDraft,
  });

  const opponentTurnDraftInvite = await createInvite({
    fromUserId: host.id,
    toUserId: guest.id,
    mode: "live_draft",
    status: "accepted",
    inviteCode: inviteCodes.opponentTurnDraft,
  });

  const completedDraftInvite = await createInvite({
    fromUserId: host.id,
    toUserId: guest.id,
    mode: "live_draft",
    status: "accepted",
    inviteCode: inviteCodes.completedDraft,
  });

  const waitingDraft = await createDraftSession({
    invite_id: waitingDraftInvite.id,
    user_a: host.id,
    user_b: guest.id,
    player_pool: DRAFT_POOL,
    picks: [],
    current_pick: 1,
    current_picker: null,
    status: "waiting",
    budget_per_team: 200,
    pick_time_limit: 30,
  });

  const activeTurnDraft = await createDraftSession({
    invite_id: activeTurnDraftInvite.id,
    user_a: host.id,
    user_b: guest.id,
    player_pool: DRAFT_POOL,
    picks: [
      { user_id: host.id, player_id: "vinicius_01", pick_number: 1 },
      { user_id: guest.id, player_id: "saka_01", pick_number: 2 },
      { user_id: guest.id, player_id: "rodri_01", pick_number: 3 },
      { user_id: host.id, player_id: "haaland_01", pick_number: 4 },
    ],
    current_pick: 5,
    current_picker: host.id,
    status: "drafting",
    budget_per_team: 200,
    pick_time_limit: 30,
  });

  const opponentTurnDraft = await createDraftSession({
    invite_id: opponentTurnDraftInvite.id,
    user_a: host.id,
    user_b: guest.id,
    player_pool: DRAFT_POOL,
    picks: [
      { user_id: host.id, player_id: "mbappe_01", pick_number: 1 },
    ],
    current_pick: 2,
    current_picker: guest.id,
    status: "drafting",
    budget_per_team: 200,
    pick_time_limit: 30,
  });

  const completedDraft = await createDraftSession({
    invite_id: completedDraftInvite.id,
    user_a: host.id,
    user_b: guest.id,
    player_pool: DRAFT_POOL,
    picks: buildCompletedPicks(host.id, guest.id),
    current_pick: 23,
    current_picker: null,
    status: "completed",
    budget_per_team: 200,
    pick_time_limit: 30,
  });

  console.log("QA state fixture ready");
  printAccount("host", host);
  printAccount("guest", guest);
  console.log(`route_play_host=${baseUrl}/play`);
  console.log(`route_play_friend_create=${baseUrl}/play?qaFriendView=create`);
  console.log(`route_play_friend_join_bring_squad=${baseUrl}/play?qaFriendView=join&qaInviteCode=${pendingBringSquadInvite.invite_code}`);
  console.log(`route_play_friend_join_live_draft=${baseUrl}/play?qaFriendView=join&qaInviteCode=${pendingLiveDraftInvite.invite_code}`);
  console.log(`route_play_friend_pending=${baseUrl}/play?qaFriendView=pending`);
  console.log(`route_draft_waiting=${baseUrl}/draft/${waitingDraft.id}`);
  console.log(`route_draft_active_turn=${baseUrl}/draft/${activeTurnDraft.id}`);
  console.log(`route_draft_opponent_turn=${baseUrl}/draft/${opponentTurnDraft.id}`);
  console.log(`route_draft_completed=${baseUrl}/draft/${completedDraft.id}`);
  console.log(`invite_pending_bring_squad=${pendingBringSquadInvite.invite_code}`);
  console.log(`invite_pending_live_draft=${pendingLiveDraftInvite.invite_code}`);
}

main().catch((error) => {
  console.error("Failed to prepare QA state fixture:", error);
  process.exit(1);
});
