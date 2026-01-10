import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { GuestModeProvider } from './contexts/GuestModeContext';
import { ScriptExecutionProvider } from './contexts/ScriptExecutionContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { FlexibleRoute } from './components/FlexibleRoute';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { GuestDashboard } from './pages/GuestDashboard';
import { Projects } from './pages/Projects';
import { ProjectForm } from './pages/ProjectForm';
import { TestCases } from './pages/TestCases';
import { GuestTestCases } from './pages/GuestTestCases';
import { TestRuns } from './pages/TestRuns';
import { AutoGenerate } from './pages/AutoGenerate';
import { DesktopAgents } from './pages/DesktopAgents';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScriptExecutionProvider>
          <GuestModeProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Main dashboard - supports both authenticated and guest modes */}
              <Route path="/dashboard" element={
                <FlexibleRoute guestFallback={<GuestDashboard />}>
                  <Dashboard />
                </FlexibleRoute>
              } />

              {/* Test cases - supports both authenticated and guest modes */}
              <Route path="/testcases" element={
                <FlexibleRoute guestFallback={<GuestTestCases />}>
                  <TestCases />
                </FlexibleRoute>
              } />

              <Route path="/testcases/new" element={
                <FlexibleRoute guestFallback={<GuestTestCases />}>
                  <TestCases />
                </FlexibleRoute>
              } />

              {/* Auto generate - available to guest users */}
              <Route path="/auto-generate" element={
                <FlexibleRoute>
                  <AutoGenerate />
                </FlexibleRoute>
              } />

              {/* Projects - requires authentication for cloud features */}
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

              {/* Test runs - requires authentication for cloud execution */}
              <Route path="/test-runs" element={
                <ProtectedRoute>
                  <TestRuns />
                </ProtectedRoute>
              } />

              {/* Desktop agents - requires authentication for cloud sync */}
              <Route path="/desktop-agents" element={
                <ProtectedRoute>
                  <DesktopAgents />
                </ProtectedRoute>
              } />
            </Routes>
          </GuestModeProvider>
        </ScriptExecutionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
