import imageCompression from 'browser-image-compression';

/**
 * 画像のEXIF orientationを修正してBlobを返す
 */
export async function correctImageOrientation(file: File): Promise<File> {
  // 画像ファイルでない場合はそのまま返す
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    const options = {
      maxSizeMB: 10, // 最大10MB（圧縮しない）
      maxWidthOrHeight: 4096, // 最大サイズ
      useWebWorker: true,
      exifOrientation: undefined, // EXIF orientationを自動修正
    };

    // EXIF orientationを修正した画像を取得
    const correctedFile = await imageCompression(file, options);
    
    // 元のファイル名を保持
    return new File([correctedFile], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    });
  } catch (error) {
    console.error('Failed to correct image orientation:', error);
    // エラー時は元のファイルを返す
    return file;
  }
}
