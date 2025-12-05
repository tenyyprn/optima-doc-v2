import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";

interface Project {
  project_id: string;
  name: string;
  status: string;
  created_at: string;
}

function RecommendPage() {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/datacheck/projects`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to load projects');

      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectId.trim()) {
      navigate(`/recommend/${projectId}`);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 w-full max-w-4xl mx-auto my-4 sm:my-8">
      <button
        onClick={() => navigate("/")}
        className="text-blue-600 hover:text-blue-800 flex items-center mb-4 sm:mb-6 text-sm sm:text-base"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 sm:h-5 sm:w-5 mr-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        戻る
      </button>

      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-800">レコメンド</h1>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800">
          プロジェクトIDを入力してください
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="例: c1f2ce09-8609-4426-8cf..."
            className="flex-1 px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
          />
          <button
            type="submit"
            disabled={!projectId.trim()}
            className="px-4 py-2 sm:px-6 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm sm:text-base whitespace-nowrap"
          >
            開く
          </button>
        </form>

        <div className="mt-3 sm:mt-4">
          <p className="text-xs sm:text-sm text-gray-600">または下記から選択</p>
        </div>
      </div>

      {/* プロジェクト一覧 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800">
          データチェックプロジェクト一覧
        </h2>

        {loading ? (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm">読み込み中...</p>
          </div>
        ) : projects.length === 0 ? (
          <p className="text-gray-600 text-sm">プロジェクトがありません</p>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <button
                key={project.project_id}
                onClick={() => navigate(`/recommend/${project.project_id}`)}
                className="w-full text-left border border-gray-300 rounded-lg p-3 sm:p-4 hover:bg-white hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate">
                      {project.name}
                    </h3>
                    <p className="text-gray-600 text-xs sm:text-sm mt-1">
                      {new Date(project.created_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecommendPage;
