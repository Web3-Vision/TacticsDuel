import { Magic } from "magic-sdk";
import { EVMExtension } from "@magic-ext/evm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let magicInstance: any = null;

export function getMagic() {
  if (magicInstance) return magicInstance as InstanceType<typeof Magic>;

  magicInstance = new Magic(
    process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY!,
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
