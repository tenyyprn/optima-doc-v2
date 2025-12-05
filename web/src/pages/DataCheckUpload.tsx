import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';
import { correctImageOrientation } from '../utils/imageUtils';

interface FileUpload {
  type: string;
  file: File | null;
  uploaded: boolean;
}

function DataCheckUpload() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState('');
  const [files, setFiles] = useState<FileUpload[]>([
    { type: 'datacheck_work_order', file: null, uploaded: false },
    { type: 'datacheck_invoice', file: null, uploaded: false },
    { type: 'datacheck_export_declaration', file: null, uploaded: false },
  ]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

  // モバイル判定
  useState(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  });

  const fileLabels: Record<string, string> = {
    datacheck_work_order: '作業依頼書(輸出)',
    datacheck_invoice: 'INVOICE',
    datacheck_export_declaration: '輸出申告事項登録',
  };

  const handleFileSelect = async (index: number, file: File) => {
    setProcessingImage(true);
    try {
      // EXIF orientationを修正
      const correctedFile = await correctImageOrientation(file);
      const newFiles = [...files];
      newFiles[index].file = correctedFile;
      setFiles(newFiles);
    } catch (error) {
      console.error('Failed to process image:', error);
      // エラー時は元のファイルを使用
      const newFiles = [...files];
      newFiles[index].file = file;
      setFiles(newFiles);
    } finally {
      setProcessingImage(false);
    }
  };

  const allFilesSelected = files.every(f => f.file !== null);

  const handleCreateProject = async () => {
    if (!allFilesSelected) return;

    setUploading(true);
    setError(null);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      // 1. プロジェクト初期化
      const initResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/datacheck/projects/init`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName || undefined,
          files: files.map(f => ({
            type: f.type,
            filename: f.file!.name,
            content_type: f.file!.type,
          })),
        }),
      });

      if (!initResponse.ok) throw new Error('Failed to initialize project');

      const initData = await initResponse.json();
      const projectId = initData.project_id;

      // 2. 各ファイルをS3にアップロード
      for (let i = 0; i < files.length; i++) {
        const file = files[i].file!;
        const document = initData.documents[i];

        await fetch(document.presigned_url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        const newFiles = [...files];
        newFiles[i].uploaded = true;
        setFiles(newFiles);
      }

      // 3. アップロード完了通知
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/datacheck/projects/${projectId}/upload-complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // 4. プロジェクト詳細画面へ遷移
      navigate(`/datacheck/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-7xl mx-auto my-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/datacheck')}
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
      </div>

      <h1 className="text-3xl font-bold mb-6 text-gray-800">新規プロジェクト作成</h1>

      <div className="mb-6">
        <label className="block text-gray-700 font-semibold mb-2">
          プロジェクト名（任意）
        </label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 2025年11月輸出案件"
        />
      </div>

      <p className="text-gray-700 mb-6">3つの帳票をアップロードしてください</p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-3 mb-6">
        {files.map((fileUpload, index) => (
          <div key={fileUpload.type} className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-800 mb-2">
                  {fileLabels[fileUpload.type]}
                </h3>
                {processingImage && !fileUpload.file ? (
                  <div className="flex items-center text-blue-600 text-sm">
                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    画像を処理中...
                  </div>
                ) : fileUpload.file ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-green-600 text-sm">
                      {fileUpload.uploaded ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          アップロード完了: {fileUpload.file.name}
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {fileUpload.file.name}
                        </>
                      )}
                    </div>
                    {!uploading && (
                      <button
                        onClick={() => {
                          const newFiles = [...files];
                          newFiles[index].file = null;
                          setFiles(newFiles);
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        削除
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-sm text-gray-500">PDF, JPG, PNG対応</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {isMobile && (
                        <label className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 cursor-pointer transition-colors text-center">
                          撮影
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => e.target.files && handleFileSelect(index, e.target.files[0])}
                            className="hidden"
                            disabled={uploading}
                          />
                        </label>
                      )}
                      <label className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer transition-colors text-center">
                        ファイルを選択
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => e.target.files && handleFileSelect(index, e.target.files[0])}
                          className="hidden"
                          disabled={uploading}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <button
          onClick={handleCreateProject}
          disabled={!allFilesSelected || uploading}
          className={`px-8 py-3 rounded-lg font-semibold transition-colors ${
            allFilesSelected && !uploading
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {uploading ? 'アップロード中...' : 'プロジェクト作成'}
        </button>
        {!allFilesSelected && (
          <p className="text-gray-600 text-sm mt-2">
            ※3つ全てのファイルを選択してください
          </p>
        )}
      </div>
    </div>
  );
}

export default DataCheckUpload;
