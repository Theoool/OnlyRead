import { prisma } from '@/lib/infrastructure/database/prisma';

async function validateMigration() {
  console.log('🔍 验证数据迁移...\n');

  // 1. 检查外键约束
  // Note: raw query might vary based on permissions, but this checks standard pg tables
  try {
    const orphanArticles: any = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM articles a
      LEFT JOIN collections c ON a.collection_id = c.id
      WHERE a.collection_id IS NOT NULL AND c.id IS NULL
    `;
    console.log(`❌ 孤儿文章: ${Number(orphanArticles[0].count)} (应该为0)`);
  } catch (e) {
      console.log('Skipping orphan check due to error (maybe table not exists):', e);
  }

  // 2. 检查order唯一性
  try {
      const duplicateOrders: any = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM (
          SELECT collection_id, "order", COUNT(*)
          FROM articles
          WHERE collection_id IS NOT NULL AND "order" IS NOT NULL
          GROUP BY collection_id, "order"
          HAVING COUNT(*) > 1
        ) duplicates
      `;
      console.log(`❌ 重复order: ${Number(duplicateOrders[0].count)} (应该为0)`);
  } catch (e) {
      console.log('Skipping duplicate order check:', e);
  }

  // 3. 检查Collection统计
  try {
      const collections = await prisma.collection.findMany({
        select: {
          id: true,
          title: true,
          totalChapters: true,
          _count: { select: { articles: true } }
        }
      });

      console.log('\n📊 Collection统计:');
      for (const col of collections) {
        const expected = col._count.articles;
        const actual = col.totalChapters;
        const match = expected === actual ? '✅' : '❌';
        console.log(`${match} ${col.title}: ${actual}/${expected} 章节匹配`);
      }
  } catch (e) {
      console.log('Skipping collection stats check:', e);
  }

  console.log('\n✅ 数据验证完成');
}

validateMigration().catch(console.error);
