/**
 * Helper function to ensure user exists in database
 * This is needed because Supabase Auth and Prisma Database are separate
 */
import { UnauthorizedError } from '../infrastructure/error';
import { createClient } from './server'
import { prisma } from '@/lib/infrastructure/database/prisma';




export async function getOrCreateUser() {
  const supabase = await createClient()
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

  if (!authUser || authError) {
    return null
  }

  // Try to get user from database
  let user = await prisma.user.findUnique({
    where: { id: authUser.id },
  })

  // If user doesn't exist in database, create them
  if (!user) {
    console.log('Creating user in database:', authUser.id, authUser.email)
    try {
      user = await prisma.user.create({
        data: {
          id: authUser.id,
          email: authUser.email!,
          fullName: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
          avatarUrl: authUser.user_metadata?.avatar_url || null,
          subscriptionType: 'free',
        },
      })
      console.log('✅ User created successfully')
    } catch (error: any) {
      console.error('❌ Failed to create user:', error)
      return null
    }
  }

  // Update last active (async, non-blocking)
  updateLastActiveAsync(user.id)

  return user
}
export async function requireUserFromHeader(req: Request) {
  const userId = req.headers.get('x-user-id')
  const userEmail = req.headers.get('x-user-email')

  if (!userId) {
    throw new UnauthorizedError('未认证')
  }

  // 直接查数据库，不再调用 supabase.auth.getUser()！
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      subscriptionType: true,
      // 不需要 lastActiveAt  here，异步更新即可
    }
  })

  // 自动创建用户（如果 Supabase 有但 DB 没有）
  if (!user) {
    console.log('Creating user from header:', userId, userEmail)
    try {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: userEmail || '',
          subscriptionType: 'free',
        },
      })
    } catch (error) {
      console.error('Failed to create user:', error)
      throw new UnauthorizedError('用户创建失败')
    }
  }

  // 异步更新最后活跃时间（不阻塞响应）
  updateLastActiveAsync(userId)

  return user
}

// 异步更新，零延迟
function updateLastActiveAsync(userId: string) {
  // 方案 A：直接异步，不 await
  prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  }).catch(err => console.error('Failed to update lastActive:', err))


}
