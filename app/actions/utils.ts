import { getOrCreateUser } from "@/lib/supabase/user";
import { UnauthorizedError } from "@/lib/infrastructure/error";

export async function requireUser() {
  const user = await getOrCreateUser();
  if (!user) {
    throw new UnauthorizedError('Unauthorized');
  }
  return user;
}
