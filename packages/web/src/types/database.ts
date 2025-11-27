export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface TestCase {
  id: string;
  project_id: string;
  name: string;
  description: string;
  steps: TestStep[];
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface TestStep {
  id: string;
  order: number;
  action: string;
  target: string;
  value?: string;
  expected_result?: string;
}

export interface TestRun {
  id: string;
  testcase_id: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  started_at: string;
  completed_at?: string;
  result_data?: any;
}

export interface DesktopAgent {
  id: string;
  user_id: string;
  name: string;
  platform: 'windows' | 'macos';
  status: 'online' | 'offline';
  last_seen: string;
}
