import { Magic } from "magic-sdk";
import { EVMExtension } from "@magic-ext/evm";

// Publishable key is public (like Supabase anon key) — safe to hardcode as fallback.
// Next.js inlines NEXT_PUBLIC_* at build time; if the env var isn't set during build,
// the runtime value is undefined. This fallback ensures it always works.
const MAGIC_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY || "pk_live_0ACCBBCDC315E0AD";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let magicInstance: any = null;

export function getMagic() {
  if (magicInstance) return magicInstance as InstanceType<typeof Magic>;

  magicInstance = new Magic(
    MAGIC_PUBLISHABLE_KEY,
    {
      extensions: [
        new EVMExtension([
          {
            rpcUrl: "https://rpc.chiliz.com",
            chainId: 88888,
            default: true,
          },
          {
            rpcUrl: "https://mainnet.base.org",
            chainId: 8453,
          },
        ]),
      ],
    }
  );

  return magicInstance as InstanceType<typeof Magic>;
}
