import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';

interface FieldData {
  name: string;
  display: string;
  value: string;
  source: string | null;
  filled: boolean;
  recommendation?: string;
}

function DockReceiptEdit() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [fields, setFields] = useState<FieldData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fillRate, setFillRate] = useState(0);
  const [filledCount, setFilledCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/datacheck/projects/${projectId}/recommend`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
          }
        );

        if (!response.ok) throw new Error('Failed to load recommend data');

        const data = await response.json();
        setFields(data.fields);
        setFillRate(data.fill_rate);
        setFilledCount(data.filled_count);
        setTotalCount(data.total_count);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recommend data');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const handleFieldChange = (index: number, value: string) => {
    const newFields = [...fields];
    newFields[index].value = value;
    newFields[index].filled = value.trim() !== '';
    setFields(newFields);
    
    // 充実度を再計算
    const newFilledCount = newFields.filter(f => f.filled).length;
    setFilledCount(newFilledCount);
    setFillRate(Math.round((newFilledCount / totalCount) * 100));
  };

  const handleSave = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/datacheck/projects/${projectId}/dock-receipt`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fields }),
        }
      );

      if (!response.ok) throw new Error('Failed to save');

      alert('保存しました');
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 w-full max-w-4xl mx-auto my-4 sm:my-8">
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 w-full max-w-4xl mx-auto my-4 sm:my-8">
        <button
          onClick={() => navigate('/recommend')}
          className="text-blue-600 hover:text-blue-800 flex items-center text-sm sm:text-base mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 w-full max-w-4xl mx-auto my-4 sm:my-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <button
          onClick={() => navigate('/recommend')}
          className="text-blue-600 hover:text-blue-800 flex items-center text-sm sm:text-base"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 sm:px-6 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm sm:text-base"
        >
          保存
        </button>
      </div>

      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 text-gray-800">ドックレシート</h1>
      <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">プロジェクトID: {projectId}</p>

      {/* 充実度バー */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm sm:text-lg font-semibold text-gray-800">{fillRate}% ({filledCount}/{totalCount}項目入力済み)</span>
        </div>
        <div className="bg-gray-200 rounded-full h-3 sm:h-4">
          <div 
            className="bg-blue-600 h-3 sm:h-4 rounded-full transition-all"
            style={{width: `${fillRate}%`}}
          />
        </div>
        <div className="mt-2 sm:mt-3">
          <button
            onClick={() => navigate(`/datacheck/projects/${projectId}`)}
            className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm underline"
          >
            データチェック結果を見る
          </button>
        </div>
      </div>

      {/* 入力フォーム */}
      <div className="space-y-4 sm:space-y-6">
        {fields.map((field, index) => (
          <div key={field.name} className="border border-gray-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-center mb-2">
              <span className="text-base sm:text-lg font-semibold text-gray-800">{field.display}</span>
              {field.filled ? (
                <span className="ml-2 text-green-600">✓</span>
              ) : (
                <span className="ml-2 text-yellow-600">⚠️</span>
              )}
            </div>
            
            <input
              type="text"
              value={field.value}
              onChange={(e) => handleFieldChange(index, e.target.value)}
              className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
              placeholder={field.filled ? '' : '入力してください'}
            />
            
            {field.filled && field.source && (
              <p className="text-xs sm:text-sm text-gray-600 mt-2">取得元: {field.source}</p>
            )}
            
            {!field.filled && field.recommendation && (
              <p className="text-xs sm:text-sm text-blue-600 mt-2">💡 {field.recommendation}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 sm:mt-8 text-center">
        <button
          onClick={handleSave}
          className="px-6 py-2 sm:px-8 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm sm:text-base"
        >
          保存して完了
        </button>
      </div>
    </div>
  );
}

export default DockReceiptEdit;
