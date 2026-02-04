import { NextResponse } from 'next/server';
import { importFile } from '@/app/actions/import';

export const POST = async (req: Request) => {
  try {
    const json = await req.json();
    const { filePath, originalName, fileType } = json;

    if (!filePath || !originalName) {
      return NextResponse.json(
        { error: 'Missing required fields: filePath, originalName' },
        { status: 400 }
      );
    }

    const result = await importFile(filePath, originalName, fileType);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Import file error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import file' },
      { status: 500 }
    );
  }
};
