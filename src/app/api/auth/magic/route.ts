import { NextRequest, NextResponse } from "next/server";
import { getMagicAdmin } from "@/lib/magic/server";
import { createClient } from "@supabase/supabase-js";

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

    // Check if user exists in Supabase
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email === email
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      // Update wallet address on profile if not set
      if (walletAddress) {
        await supabaseAdmin
          .from("profiles")
          .update({ wallet_address: walletAddress })
          .eq("id", userId)
          .is("wallet_address", null);
      }
    } else {
      // Create new Supabase user
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
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
        // Small delay to let the trigger fire
        await new Promise((r) => setTimeout(r, 500));
        await supabaseAdmin
          .from("profiles")
          .update({ wallet_address: walletAddress })
          .eq("id", userId);
      }
    }

    // Generate a magic link for the user to create a Supabase session
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: `${request.nextUrl.origin}/auth/callback`,
        },
      });

    if (linkError || !linkData) {
      return NextResponse.json(
        { error: linkError?.message || "Failed to generate session link" },
        { status: 500 }
      );
    }

    // Extract the token from the link and return it
    // The link contains a token_hash we can use
    const hashed_token = linkData.properties?.hashed_token;
    const verification_url = linkData.properties?.action_link;

    return NextResponse.json({
      userId,
      walletAddress,
      verificationUrl: verification_url,
      hashedToken: hashed_token,
    });
  } catch (error) {
    console.error("Magic auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }
}
