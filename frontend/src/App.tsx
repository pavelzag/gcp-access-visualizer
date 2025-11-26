import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { apiClient } from './api/client';
import { UsersList } from './components/UsersList';
import { ResourcesList } from './components/ResourcesList';
import { AccessMatrix } from './components/AccessMatrix';
import { NetworkGraph } from './components/NetworkGraph';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

type ViewMode = 'users' | 'resources' | 'matrix' | 'graph';

function AppContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [resourceSearchTerm, setResourceSearchTerm] = useState('');

  // Fetch data
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: apiClient.getUsers,
  });

  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: apiClient.getResources,
  });

  const { data: accessMatrix, isLoading: accessLoading } = useQuery({
    queryKey: ['access'],
    queryFn: apiClient.getAccessMatrix,
  });

  const renderView = () => {
    switch (viewMode) {
      case 'users':
        return (
          <UsersList
            users={users}
            isLoading={usersLoading}
            searchTerm={userSearchTerm}
            onSearchChange={setUserSearchTerm}
          />
        );
      case 'resources':
        return (
          <ResourcesList
            resources={resources}
            isLoading={resourcesLoading}
            searchTerm={resourceSearchTerm}
            onSearchChange={setResourceSearchTerm}
          />
        );
      case 'matrix':
        return <AccessMatrix data={accessMatrix || null} isLoading={accessLoading} />;
      case 'graph':
        return <NetworkGraph data={accessMatrix || null} isLoading={accessLoading} />;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-title">
            <h1>🔐 GCP Access Visualizer</h1>
            <p className="header-subtitle">
              Visualize and analyze IAM permissions across your GCP resources
            </p>
          </div>

          <nav className="nav-tabs">
            <button
              className={`nav-tab ${viewMode === 'graph' ? 'active' : ''}`}
              onClick={() => setViewMode('graph')}
            >
              <span className="nav-icon">🌐</span>
              Network Graph
            </button>
            <button
              className={`nav-tab ${viewMode === 'matrix' ? 'active' : ''}`}
              onClick={() => setViewMode('matrix')}
            >
              <span className="nav-icon">📊</span>
              Access Matrix
            </button>
            <button
              className={`nav-tab ${viewMode === 'users' ? 'active' : ''}`}
              onClick={() => setViewMode('users')}
            >
              <span className="nav-icon">👥</span>
              Users
            </button>
            <button
              className={`nav-tab ${viewMode === 'resources' ? 'active' : ''}`}
              onClick={() => setViewMode('resources')}
            >
              <span className="nav-icon">📦</span>
              Resources
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {renderView()}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
