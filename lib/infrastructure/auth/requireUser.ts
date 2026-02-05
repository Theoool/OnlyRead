import { getOrCreateUser } from '@/lib/supabase/user';
import { UnauthorizedError } from '@/lib/infrastructure/error';

/**
 * Helper to ensure user is authenticated.
 * Throws UnauthorizedError if user is not found.
 * Usage: const user = await requireUser();
 */
export async function requireUser() {
    const user = await getOrCreateUser();
    if (!user) {
        throw new UnauthorizedError();
    }
    return user;
}
