import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container bg-white rounded-lg shadow-md p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-800">AutoExtract</h1>
        <p className="text-base sm:text-xl text-gray-600">
          AI-OCRによる帳票読み取りソリューション
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* メインアクション: 2つのカード */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* データチェック */}
          <div
            className="border-2 border-gray-200 rounded-lg p-8 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
            onClick={() => navigate("/datacheck")}
          >
            <div className="text-center">
              <div className="bg-blue-100 text-blue-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-gray-800">
                データチェック
              </h2>
              <p className="text-gray-600 mb-6">
                OCR結果の検証とデータ品質チェック
              </p>
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors">
                開始する
              </button>
            </div>
          </div>

          {/* レコメンド */}
          <div
            className="border-2 border-gray-200 rounded-lg p-8 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer"
            onClick={() => navigate("/recommend")}
          >
            <div className="text-center">
              <div className="bg-green-100 text-green-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-gray-800">
                レコメンド
              </h2>
              <p className="text-gray-600 mb-6">
                ドックレシート作成のための次のアクションを推薦
              </p>
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors">
                開始する
              </button>
            </div>
          </div>
        </div>

        {/* 汎用AutoExtractへのリンク */}
        <div className="text-center border-t pt-6">
          <p className="text-gray-600 mb-2">
            汎用的な帳票読み取り機能をお探しですか？
          </p>
          <button
            onClick={() => navigate("/autoextract")}
            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center justify-center mx-auto"
          >
            AutoExtract（汎用機能）へ
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 ml-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
