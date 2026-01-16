import { prisma } from '../lib/infrastructure/database/prisma'

async function main() {
  console.log('Checking and applying pg_trgm indexes...')

  try {
    // 1. Enable pg_trgm extension
    console.log('Enabling pg_trgm extension...')
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
    console.log('✅ pg_trgm extension enabled')

    // 2. Concepts indexes
    console.log('Creating indexes for concepts...')
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS concepts_term_trgm_idx ON concepts USING GIN (term gin_trgm_ops);
    `)
    console.log('✅ concepts_term_trgm_idx created')

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS concepts_my_definition_trgm_idx ON concepts USING GIN (my_definition gin_trgm_ops);
    `)
    console.log('✅ concepts_my_definition_trgm_idx created')

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS concepts_my_example_trgm_idx ON concepts USING GIN (my_example gin_trgm_ops);
    `)
    console.log('✅ concepts_my_example_trgm_idx created')

    // 3. Articles indexes
    console.log('Creating indexes for articles...')
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS articles_title_trgm_idx ON articles USING GIN (title gin_trgm_ops);
    `)
    console.log('✅ articles_title_trgm_idx created')

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS articles_content_trgm_idx ON articles USING GIN (content gin_trgm_ops);
    `)
    console.log('✅ articles_content_trgm_idx created')

    console.log('🎉 All indexes applied successfully!')

  } catch (error) {
    console.error('❌ Error applying indexes:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
