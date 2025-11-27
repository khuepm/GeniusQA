/*
  # Create Projects and Test Cases Schema

  ## New Tables
  
  ### `projects`
  - `id` (uuid, primary key) - Unique project identifier
  - `name` (text) - Project name
  - `description` (text) - Project description
  - `user_id` (uuid) - Owner of the project (references auth.users)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `testcases`
  - `id` (uuid, primary key) - Unique test case identifier
  - `project_id` (uuid) - Associated project (references projects)
  - `name` (text) - Test case name
  - `description` (text) - Test case description
  - `steps` (jsonb) - Array of test steps in JSON format
  - `status` (text) - Status: draft, active, or archived
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `test_runs`
  - `id` (uuid, primary key) - Unique test run identifier
  - `testcase_id` (uuid) - Associated test case (references testcases)
  - `status` (text) - Execution status: pending, running, passed, failed
  - `started_at` (timestamptz) - Execution start time
  - `completed_at` (timestamptz) - Execution completion time
  - `result_data` (jsonb) - Detailed results in JSON format

  ### `desktop_agents`
  - `id` (uuid, primary key) - Unique agent identifier
  - `user_id` (uuid) - Owner of the agent (references auth.users)
  - `name` (text) - Agent name
  - `platform` (text) - Platform: windows or macos
  - `status` (text) - Connection status: online or offline
  - `last_seen` (timestamptz) - Last activity timestamp

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to manage their own data
  - Projects are private to their owners
  - Test cases are accessible to project owners
  - Test runs are accessible to testcase owners
  - Desktop agents are private to their owners
*/

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS testcases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  steps jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  testcase_id uuid NOT NULL REFERENCES testcases(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'passed', 'failed')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  result_data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS desktop_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('windows', 'macos')),
  status text DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  last_seen timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE testcases ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE desktop_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view testcases in their projects"
  ON testcases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = testcases.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert testcases in their projects"
  ON testcases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = testcases.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update testcases in their projects"
  ON testcases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = testcases.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = testcases.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete testcases in their projects"
  ON testcases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = testcases.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view test runs for their testcases"
  ON test_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM testcases
      JOIN projects ON projects.id = testcases.project_id
      WHERE testcases.id = test_runs.testcase_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert test runs for their testcases"
  ON test_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM testcases
      JOIN projects ON projects.id = testcases.project_id
      WHERE testcases.id = test_runs.testcase_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update test runs for their testcases"
  ON test_runs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM testcases
      JOIN projects ON projects.id = testcases.project_id
      WHERE testcases.id = test_runs.testcase_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM testcases
      JOIN projects ON projects.id = testcases.project_id
      WHERE testcases.id = test_runs.testcase_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own desktop agents"
  ON desktop_agents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own desktop agents"
  ON desktop_agents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own desktop agents"
  ON desktop_agents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own desktop agents"
  ON desktop_agents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_testcases_project_id ON testcases(project_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_testcase_id ON test_runs(testcase_id);
CREATE INDEX IF NOT EXISTS idx_desktop_agents_user_id ON desktop_agents(user_id);
