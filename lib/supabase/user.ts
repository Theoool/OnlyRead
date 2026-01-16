/**
 * Helper function to ensure user exists in database
 * This is needed because Supabase Auth and Prisma Database are separate
 */
import { createClient } from './server'
import { prisma } from '@/lib/prisma'

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

  // Update last active
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    })
  } catch (error) {
    console.error('Failed to update last active:', error)
  }

  return user
}
