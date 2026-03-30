import { NextRequest, NextResponse } from "next/server";
import { getMagicAdmin } from "@/lib/magic/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { didToken, username, clubName } = await request.json();

    if (!didToken) {
      return NextResponse.json(
        { error: "Missing DID token" },
        { status: 400 }
      );
    }

    // Verify the DID token with Magic
    const magic = await getMagicAdmin();
    magic.token.validate(didToken);
    const metadata = await magic.users.getMetadataByToken(didToken);

    const email = metadata.email;
    const walletAddress = metadata.publicAddress;

    if (!email) {
      return NextResponse.json(
        { error: "No email found in Magic token" },
        { status: 400 }
      );
    }

    // Generate a temp password for Supabase session (never shown to user)
    const tempPassword = `magic_${randomUUID()}_${Date.now()}`;

    // Find user by email
    const { data: existingUserData } =
      await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUserData?.users?.find(
      (u) => u.email === email
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      // Set temp password for session creation (no email sent)
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
      });

      // Update wallet address on profile if not set
      if (walletAddress) {
        await supabaseAdmin
          .from("profiles")
          .update({ wallet_address: walletAddress })
          .eq("id", userId)
          .is("wallet_address", null);
      }
    } else {
      // Create new Supabase user with temp password (no email sent)
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            username: username || `Manager_${email.split("@")[0].slice(0, 6)}`,
            club_name: clubName || `FC ${email.split("@")[0].slice(0, 6)}`,
            wallet_address: walletAddress,
          },
        });

      if (createError || !newUser.user) {
        return NextResponse.json(
          { error: createError?.message || "Failed to create user" },
          { status: 500 }
        );
      }

      userId = newUser.user.id;

      // Update wallet address on profile (trigger creates the profile)
      if (walletAddress) {
        await new Promise((r) => setTimeout(r, 500));
        await supabaseAdmin
          .from("profiles")
          .update({ wallet_address: walletAddress })
          .eq("id", userId);
      }
    }

    // Return email + temp password so client can signInWithPassword
    // This bypasses ALL Supabase email rate limits
    return NextResponse.json({
      email,
      tempPassword,
      userId,
      walletAddress,
    });
  } catch (error) {
    console.error("Magic auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }
}
