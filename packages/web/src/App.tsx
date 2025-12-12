import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectForm } from './pages/ProjectForm';
import { TestCases } from './pages/TestCases';
import { TestRuns } from './pages/TestRuns';
import { AutoGenerate } from './pages/AutoGenerate';
import { DesktopAgents } from './pages/DesktopAgents';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/projects" element={
            <ProtectedRoute>
              <Projects />
            </ProtectedRoute>
          } />

          <Route path="/projects/new" element={
            <ProtectedRoute>
              <ProjectForm />
            </ProtectedRoute>
          } />

          <Route path="/projects/:id/edit" element={
            <ProtectedRoute>
              <ProjectForm />
            </ProtectedRoute>
          } />

          <Route path="/testcases" element={
            <ProtectedRoute>
              <TestCases />
            </ProtectedRoute>
          } />

          <Route path="/testcases/new" element={
            <ProtectedRoute>
              <TestCases />
            </ProtectedRoute>
          } />

          <Route path="/test-runs" element={
            <ProtectedRoute>
              <TestRuns />
            </ProtectedRoute>
          } />

          <Route path="/auto-generate" element={
            <ProtectedRoute>
              <AutoGenerate />
            </ProtectedRoute>
          } />

          <Route path="/desktop-agents" element={
            <ProtectedRoute>
              <DesktopAgents />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
