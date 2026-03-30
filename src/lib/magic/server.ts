import { Magic } from "@magic-sdk/admin";

let magicAdmin: InstanceType<typeof Magic> | null = null;

export async function getMagicAdmin() {
  if (magicAdmin) return magicAdmin;
  magicAdmin = await Magic.init(process.env.MAGIC_SECRET_KEY!);
  return magicAdmin;
}
