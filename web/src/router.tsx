import { createBrowserRouter, Outlet } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import App from './App';
import Home from './pages/Home';
import AutoExtractHome from './pages/AutoExtractHome';
import DataCheckPage from './pages/DataCheckPage';
import DataCheckUpload from './pages/DataCheckUpload';
import DataCheckProject from './pages/DataCheckProject';
import RecommendPage from './pages/RecommendPage';
import DockReceiptEdit from './pages/DockReceiptEdit';
import Upload from './pages/Upload';
import OCRResult from './pages/OCRResult';
import SchemaGenerator from './pages/SchemaGenerator';
import { AppProvider } from './components/AppContext';
import '@aws-amplify/ui-react/styles.css';

// Layout component that includes the App wrapper and authentication
const AppLayout = () => {
  return (
    <Authenticator>
      {() => (
        <AppProvider>
          <App>
            <Outlet />
          </App>
        </AppProvider>
      )}
    </Authenticator>
  );
};

// Define routes
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'datacheck',
        element: <DataCheckPage />,
      },
      {
        path: 'datacheck/upload',
        element: <DataCheckUpload />,
      },
      {
        path: 'datacheck/projects/:projectId',
        element: <DataCheckProject />,
      },
      {
        path: 'recommend',
        element: <RecommendPage />,
      },
      {
        path: 'recommend/:projectId',
        element: <DockReceiptEdit />,
      },
      {
        path: 'autoextract',
        element: <AutoExtractHome />,
      },
      {
        path: 'app/:appName',
        element: <Upload />,
      },
      {
        path: 'ocr-result/:id',
        element: <OCRResult />,
      },
      {
        // 新規作成・編集共通のルート
        path: 'schema-generator',
        element: <SchemaGenerator mode="create" />,
      },
      {
        // 新規作成・編集共通のルート (appNameあり)
        path: 'schema-generator/:appName',
        element: <SchemaGenerator mode="edit" />,
      },
      {
        // 確認用
        path: 'apps/:appName/view',
        element: <SchemaGenerator mode="view" />,
      },
      {
        // 編集用 (schema-generatorにリダイレクト)
        path: 'apps/:appName/edit',
        element: <SchemaGenerator mode="edit" />,
      },
    ],
  },
]);

export default router;
