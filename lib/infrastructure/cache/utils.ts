import { devCache } from './dev-cache'

export class CacheManager {
    /**
     * Invalidate all caches for a user
     */
    static invalidateUserCaches(userId: string) {
        const patterns = [
            `articles:${userId}:*`,
            `concepts:${userId}:*`,
            `collections:${userId}:*`,
            `stats:${userId}:*`,
        ]

        patterns.forEach(pattern => {
            devCache.invalidatePattern(pattern)
        })
    }

    /**
     * Invalidate specific resource cache
     */
    static invalidateResource(userId: string, resource: 'articles' | 'concepts' | 'collections' | 'stats') {
        devCache.invalidatePattern(`${resource}:${userId}:*`)
    }
}
