import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response'
import { BadRequestError } from '@/lib/infrastructure/error'
import { requireUserFromHeader } from '@/lib/supabase/user'
import { importFileForUser } from '@/lib/import/import-file'

export const POST = apiHandler(async (req: Request) => {
  const user = await requireUserFromHeader(req)

  let json: any
  try {
    json = await req.json()
  } catch {
    throw new BadRequestError('Invalid JSON body')
  }

  const { filePath, originalName, fileType } = json || {}

  if (!filePath || !originalName) {
    throw new BadRequestError('Missing required fields: filePath, originalName')
  }

  const result = await importFileForUser({ userId: user.id, filePath, originalName, fileType })
  console.log("导入结果", result)
  return createSuccessResponse(result)
})
