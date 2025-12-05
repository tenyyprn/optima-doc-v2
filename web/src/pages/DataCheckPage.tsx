import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';

interface Project {
  project_id: string;
  name: string;
  status: string;
  created_at: string;
}

function DataCheckPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/datacheck/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load projects');

      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: '未処理', color: 'bg-gray-500' },
      ocr_processing: { label: 'OCR実行中', color: 'bg-blue-500' },
      ocr_completed: { label: 'OCR確認待ち', color: 'bg-yellow-500' },
      ready_for_check: { label: 'チェック可能', color: 'bg-green-500' },
      checking: { label: 'チェック中', color: 'bg-blue-500' },
      completed: { label: '完了', color: 'bg-green-600' },
    };

    const { label, color } = statusMap[status] || { label: status, color: 'bg-gray-500' };

    return (
      <span className={`${color} text-white px-3 py-1 rounded-full text-sm`}>
        {label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-7xl mx-auto my-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">データチェック</h1>
        <button
          onClick={() => navigate('/datacheck/upload')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>新規プロジェクト作成</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700">読み込み中...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-700 mb-4">プロジェクトがありません</p>
          <button
            onClick={() => navigate('/datacheck/upload')}
            className="text-blue-600 hover:text-blue-800 font-semibold"
          >
            新規プロジェクトを作成
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <div
              key={project.project_id}
              className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/datacheck/projects/${project.project_id}`)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    {project.name}
                  </h2>
                  <p className="text-gray-600 text-sm">
                    作成日時: {new Date(project.created_at).toLocaleString('ja-JP')}
                  </p>
                </div>
                <div>
                  {getStatusBadge(project.status)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DataCheckPage;
