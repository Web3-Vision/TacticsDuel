import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const QA_PASSWORD = "Password123!";
const STARTER_IDS = [
  "courtois_01",
  "theo_01",
  "vandijk_01",
  "dias_01",
  "hakimi_01",
  "rodri_01",
  "bellingham_01",
  "debruyne_01",
  "vinicius_01",
  "haaland_01",
  "saka_01",
];
const BENCH_IDS = Array(10).fill(null);
const FORMATION = "4-3-3";
const TACTICS = {
  formation: FORMATION,
  mentality: "Balanced",
  tempo: "Normal",
  pressing: "Medium",
  width: "Normal",
  ht_if_losing_mentality: "Attacking",
  ht_if_winning_mentality: "Defensive",
};

const qaUsers = [
  {
    email: "qa.home@example.com",
    username: "qa_home",
    clubName: "QA Home FC",
  },
  {
    email: "qa.away@example.com",
    username: "qa_away",
    clubName: "QA Away FC",
  },
];

async function isAppSchemaReady() {
  const requiredTables = ["profiles", "matches", "squads", "tactics"];

  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      return {
        ready: false,
        table,
        code: error.code ?? "unknown",
        message: error.message,
      };
    }
  }

  return { ready: true };
}

async function findUserByEmail(email) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw error;
    }

    const user = data.users.find((entry) => entry.email === email);
    if (user) {
      return user;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

async function ensureQaUser({ email, username, clubName }) {
  const existing = await findUserByEmail(email);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      email,
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username,
        club_name: clubName,
      },
    });

    if (error) {
      throw error;
    }

    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: QA_PASSWORD,
    email_confirm: true,
    user_metadata: {
      username,
      club_name: clubName,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error(`Failed to create user for ${email}`);
  }

  return data.user.id;
}

async function ensureProfile(userId, username, clubName) {
  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      username,
      club_name: clubName,
      onboarding_completed: true,
      squad_locked: true,
      account_status: "active",
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
  }
}

async function ensureTactics(userId) {
  const { error } = await supabase.from("tactics").upsert({
    user_id: userId,
    ...TACTICS,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) {
    throw error;
  }
}

async function ensureSquad(userId) {
  const { error } = await supabase.from("squads").upsert({
    user_id: userId,
    formation: FORMATION,
    player_ids: STARTER_IDS,
    bench_ids: BENCH_IDS,
    captain_id: "haaland_01",
    total_cost: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) {
    throw error;
  }
}

async function createSeededMatch(homeUserId, awayUserId) {
  const { data, error } = await supabase
    .from("matches")
    .insert({
      home_user_id: homeUserId,
      away_user_id: awayUserId,
      match_type: "friendly",
      status: "accepted",
      home_squad: [{ user_id: homeUserId, player_ids: STARTER_IDS, bench_ids: [] }],
      away_squad: [{ user_id: awayUserId, player_ids: STARTER_IDS, bench_ids: [] }],
      home_tactics: TACTICS,
      away_tactics: TACTICS,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create seeded match");
  }

  return data.id;
}

async function main() {
  const schemaStatus = await isAppSchemaReady();
  const userIds = [];

  for (const qaUser of qaUsers) {
    const userId = await ensureQaUser(qaUser);
    if (schemaStatus.ready) {
      await ensureProfile(userId, qaUser.username, qaUser.clubName);
      await ensureTactics(userId);
      await ensureSquad(userId);
    }
    userIds.push(userId);
  }

  console.log(JSON.stringify({
    qaPassword: QA_PASSWORD,
    users: qaUsers,
    ...(schemaStatus.ready
      ? {
          seededMatchId: await createSeededMatch(userIds[0], userIds[1]),
          appSchemaReady: true,
        }
      : {
          appSchemaReady: false,
          schemaIssue: schemaStatus,
        }),
  }, null, 2));
}

await main();
