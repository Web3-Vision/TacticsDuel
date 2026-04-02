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

const hostname = new URL(supabaseUrl).hostname;
const isLocalSupabase =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "0.0.0.0";

if (!isLocalSupabase && process.env.QA_FIXTURE_ALLOW_REMOTE !== "1") {
  console.error(
    `Refusing to seed QA fixture against non-local Supabase host (${hostname}). Set QA_FIXTURE_ALLOW_REMOTE=1 to override.`
  );
  process.exit(1);
}

const fixture = {
  email: process.env.QA_FIXTURE_EMAIL ?? "qa.spoa73@example.com",
  password: process.env.QA_FIXTURE_PASSWORD ?? "SPOA73-qa-local-only",
  username: process.env.QA_FIXTURE_USERNAME ?? "qa_spoa73",
  clubName: process.env.QA_FIXTURE_CLUB_NAME ?? "QA SPOA 73 FC",
  managerName: process.env.QA_FIXTURE_MANAGER_NAME ?? "QA Manager",
  age: Number(process.env.QA_FIXTURE_AGE ?? "29"),
  favoriteTeam: process.env.QA_FIXTURE_FAVORITE_TEAM ?? "Test United",
};

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  if (!error) return null;
  if (error.code !== "PGRST204") return null;
  const match = /Could not find the '([^']+)' column/i.exec(error.message ?? "");
  return match?.[1] ?? null;
}

async function upsertProfileWithSchemaFallback(userId) {
  const profilePayload = {
    id: userId,
    username: fixture.username,
    club_name: fixture.clubName,
    onboarding_completed: true,
    manager_name: fixture.managerName,
    age: fixture.age,
    favorite_team: fixture.favoriteTeam,
    manager_avatar_archetype: "Tactician",
    manager_hair_style: "Short",
    manager_hair_color: "Brown",
    manager_skin_tone: "Medium",
    manager_beard_style: "Clean",
    account_status: "active",
    paused_at: null,
    deactivated_at: null,
    updated_at: new Date().toISOString(),
  };

  while (true) {
    const { error } = await admin.from("profiles").upsert(profilePayload, { onConflict: "id" });
    if (!error) return;

    const missingColumn = parseMissingColumnFromError(error);
    if (!missingColumn || !(missingColumn in profilePayload)) {
      throw error;
    }

    delete profilePayload[missingColumn];
  }
}

async function ensureQaFixture() {
  const existing = await findUserByEmail(fixture.email);
  let userId;

  if (existing) {
    userId = existing.id;
    const { error } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      password: fixture.password,
      user_metadata: {
        username: fixture.username,
        club_name: fixture.clubName,
      },
    });

    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: fixture.email,
      password: fixture.password,
      email_confirm: true,
      user_metadata: {
        username: fixture.username,
        club_name: fixture.clubName,
      },
    });

    if (error) throw error;
    if (!data.user) {
      throw new Error("Supabase did not return a created fixture user");
    }

    userId = data.user.id;
  }

  await upsertProfileWithSchemaFallback(userId);

  const { data: loginResult, error: loginError } = await anon.auth.signInWithPassword({
    email: fixture.email,
    password: fixture.password,
  });

  if (loginError) throw loginError;

  console.log("QA fixture ready");
  console.log(`email=${fixture.email}`);
  console.log(`password=${fixture.password}`);
  console.log(`user_id=${userId}`);
  console.log(`session_user_id=${loginResult.user?.id ?? "unknown"}`);
  console.log("Routes available after login: /profile, /club/team-hub");
}

ensureQaFixture().catch((error) => {
  console.error("Failed to prepare QA auth fixture:", error);
  process.exit(1);
});
