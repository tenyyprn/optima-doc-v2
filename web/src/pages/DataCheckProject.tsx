import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';

interface Document {
  id: string;
  document_type: string;
  filename: string;
  status: string;
  ocr_confirmed: boolean;
}

interface Project {
  project_id: string;
  name: string;
  status: string;
  created_at: string;
  documents: Document[];
  check_result: any;
}

function DataCheckProject() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileLabels: Record<string, string> = {
    datacheck_work_order: '作業依頼書(輸出)',
    datacheck_invoice: 'INVOICE',
    datacheck_export_declaration: '輸出申告事項登録',
  };

  useEffect(() => {
    loadProject();
    
    // OCR処理中またはチェック中の場合、ポーリングを開始
    const interval = setInterval(() => {
      if (project?.status === 'ocr_processing' || project?.status === 'checking') {
        loadProject();
      }
    }, 3000); // 3秒ごとにチェック
    
    return () => clearInterval(interval);
  }, [projectId, project?.status]);

  const loadProject = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/datacheck/projects/${projectId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to load project');

      const data = await response.json();
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOCR = async () => {
    setProcessing(true);
    setError(null);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/datacheck/projects/${projectId}/ocr/start`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      await loadProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start OCR');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmOCR = async (documentId: string) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/datacheck/projects/${projectId}/documents/${documentId}/confirm`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      await loadProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm OCR');
    }
  };

  const handleStartCheck = async () => {
    setProcessing(true);
    setError(null);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/datacheck/projects/${projectId}/check/start`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      await loadProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start check');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-7xl mx-auto my-8">
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-7xl mx-auto my-8">
        <p className="text-red-600">プロジェクトが見つかりません</p>
      </div>
    );
  }

  const allOCRConfirmed = project.documents.every(d => d.ocr_confirmed);
  const canStartCheck = project.status === 'ready_for_check' || (project.status === 'ocr_completed' && allOCRConfirmed);

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

      <h1 className="text-3xl font-bold mb-2 text-gray-800">{project.name}</h1>
      <p className="text-gray-600 mb-6">
        作成日時: {new Date(project.created_at).toLocaleString('ja-JP')}
      </p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">アップロード済みファイル</h2>
        
        {project.status === 'ocr_processing' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mr-3"></div>
              <div>
                <p className="font-semibold text-blue-800">OCR処理中...</p>
                <p className="text-sm text-blue-600">各ドキュメントを処理しています。完了までお待ちください。</p>
              </div>
            </div>
          </div>
        )}

        {project.status === 'checking' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-yellow-500 mr-3"></div>
              <div>
                <p className="font-semibold text-yellow-800">データチェック実行中...</p>
                <p className="text-sm text-yellow-600">ドキュメント間の整合性をチェックしています。</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {project.documents.map((doc) => (
            <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{fileLabels[doc.document_type]}</p>
                  <p className="text-sm text-gray-600 mb-2">{doc.filename}</p>
                  
                  {/* ステータス表示 */}
                  <div className="flex items-center gap-3 text-sm">
                    {doc.status === 'pending' && (
                      <span className="text-gray-500">待機中</span>
                    )}
                    {doc.status === 'processing' && (
                      <span className="text-blue-600 flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-t border-b border-blue-500 mr-1"></div>
                        処理中
                      </span>
                    )}
                    {doc.status === 'completed' && (
                      <>
                        <span className="text-green-600">✓ OCR完了</span>
                        {doc.ocr_confirmed && (
                          <span className="text-blue-600">✓ 確認済</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                {/* アクションボタン */}
                {doc.status === 'completed' && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => navigate(`/ocr-result/${doc.id}?from=datacheck&project_id=${projectId}`)}
                      className="px-4 py-2 text-blue-600 hover:bg-blue-50 border border-blue-600 rounded text-sm whitespace-nowrap transition-colors"
                    >
                      OCR結果を確認 →
                    </button>
                    {!doc.ocr_confirmed && (
                      <button
                        onClick={() => handleConfirmOCR(doc.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm whitespace-nowrap transition-colors"
                      >
                        確認完了
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        {project.status === 'pending' && (
          <button
            onClick={handleStartOCR}
            disabled={processing}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {processing ? 'OCR実行中...' : 'OCR実行'}
          </button>
        )}

        {canStartCheck && (
          <button
            onClick={handleStartCheck}
            disabled={processing}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {processing ? 'チェック実行中...' : 'データチェック実行'}
          </button>
        )}
      </div>

      {project.check_result && project.check_result.length > 0 && (
        <div className="border-t pt-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <h2 className="text-2xl font-bold">チェック結果</h2>
            <button
              onClick={handleStartCheck}
              disabled={processing}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
            >
              {processing ? '再チェック中...' : '再チェック'}
            </button>
          </div>
          <div className="space-y-4">
            {project.check_result.map((result: any, index: number) => (
              <CheckResultItem key={index} result={result} projectId={projectId!} />
            ))}
          </div>
        </div>
      )}

      {project.status === 'check_failed' && (
        <div className="border-t pt-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <p className="font-semibold text-red-800">データチェックに失敗しました</p>
                <p className="text-sm text-red-600">再度チェックを実行してください。</p>
              </div>
              <button
                onClick={handleStartCheck}
                disabled={processing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
              >
                {processing ? '再チェック中...' : '再チェック'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// チェック結果表示コンポーネント
function CheckResultItem({ result, projectId }: { result: any; projectId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, 'good' | 'bad' | null>>({});

  const handleFeedback = async (itemIndex: number, type: 'good' | 'bad', item: any) => {
    // UI更新
    setFeedback(prev => ({
      ...prev,
      [itemIndex]: prev[itemIndex] === type ? null : type
    }));
    
    // API呼び出し
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/datacheck/projects/${projectId}/feedback`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            feedback_type: type,
            doc1_name: result.doc1_name,
            doc2_name: result.doc2_name,
            doc1_id: result.doc1_id || '',
            doc2_id: result.doc2_id || '',
            field1_name: item.field1_name || '',
            field1_display: item.field1_display,
            field2_name: item.field2_name || '',
            field2_display: item.field2_display,
            value1: item.value1,
            value2: item.value2,
            status: item.status,
            reason: item.reason
          })
        }
      );
    } catch (error) {
      console.error('フィードバック保存エラー:', error);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div 
        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-lg sm:text-xl font-semibold">
          {result.doc1_name} vs {result.doc2_name}
        </h3>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-sm sm:text-lg">
            {result.matched_items}/{result.total_items} 一致 ({result.match_rate}%)
          </span>
          <span>{expanded ? '▼' : '▶'}</span>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-4 space-y-3">
          {result.items.map((item: any, itemIndex: number) => (
            <div 
              key={itemIndex}
              className={`p-3 rounded ${
                item.status === 'match' ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className="text-xl">
                    {item.status === 'match' ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold mb-1">
                      {item.field1_display} vs {item.field2_display}
                    </div>
                    <div className="text-sm space-y-1">
                      <div>{result.doc1_name}: "{item.value1}"</div>
                      <div>{result.doc2_name}: "{item.value2}"</div>
                      <div className={`font-semibold ${
                        item.status === 'match' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        → {item.reason}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* フィードバックボタン */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFeedback(itemIndex, 'good', item);
                    }}
                    className={`p-1.5 rounded transition-colors ${
                      feedback[itemIndex] === 'good'
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-green-600'
                    }`}
                    title="Good"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFeedback(itemIndex, 'bad', item);
                    }}
                    className={`p-1.5 rounded transition-colors ${
                      feedback[itemIndex] === 'bad'
                        ? 'bg-red-100 text-red-700'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-red-600'
                    }`}
                    title="Bad"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DataCheckProject;
