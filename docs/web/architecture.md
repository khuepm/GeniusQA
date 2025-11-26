# GeniusQA Web Platform - Architecture

## System Architecture

### Overview
The GeniusQA Web Platform follows a modern single-page application (SPA) architecture using React with TypeScript, integrated with Supabase for backend services.

```
┌─────────────────────────────────────────────────────────┐
│                    Client Browser                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │         React Application (SPA)                    │  │
│  │  ┌──────────────┐  ┌──────────────┐               │  │
│  │  │  Components  │  │   Context    │               │  │
│  │  │   (Pages)    │  │  (Auth, etc) │               │  │
│  │  └──────────────┘  └──────────────┘               │  │
│  │  ┌──────────────┐  ┌──────────────┐               │  │
│  │  │   Services   │  │   Types      │               │  │
│  │  └──────────────┘  └──────────────┘               │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Supabase Platform                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Auth      │  │  PostgreSQL  │  │   Storage    │  │
│  │   Service    │  │   Database   │  │   (Future)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │   Realtime   │  │  Row Level   │                     │
│  │   Service    │  │   Security   │                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Directory Structure
```
packages/web/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Layout.tsx     # Main layout with sidebar
│   │   └── ProtectedRoute.tsx  # Route guard
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx     # Authentication state
│   ├── lib/               # Utility libraries
│   │   └── supabase.ts    # Supabase client
│   ├── pages/             # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Projects.tsx
│   │   ├── ProjectForm.tsx
│   │   ├── TestCases.tsx
│   │   ├── TestRuns.tsx
│   │   ├── AutoGenerate.tsx
│   │   └── DesktopAgents.tsx
│   ├── types/             # TypeScript types
│   │   └── database.ts    # Database models
│   ├── App.tsx            # Root component with routing
│   ├── main.tsx           # Application entry point
│   └── index.css          # Global styles
├── public/                # Static assets
├── index.html             # HTML template
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind CSS config
└── package.json           # Dependencies
```

### Component Architecture

#### Layout Component
- Persistent sidebar navigation
- User profile display
- Sign out functionality
- Responsive mobile menu

#### Authentication Flow
1. `AuthProvider` wraps the entire app
2. Manages user session state
3. Provides auth methods (signIn, signUp, signOut)
4. `ProtectedRoute` guards authenticated pages

#### Page Components
- **Dashboard**: Overview with statistics and quick actions
- **Projects**: CRUD operations for projects
- **TestCases**: Manage test cases with steps
- **TestRuns**: View execution history
- **AutoGenerate**: AI-powered test generation
- **DesktopAgents**: Manage connected automation agents

## Database Schema

### Tables

#### projects
- Primary key: `id` (uuid)
- Foreign key: `user_id` → `auth.users(id)`
- Columns: name, description, created_at, updated_at

#### testcases
- Primary key: `id` (uuid)
- Foreign key: `project_id` → `projects(id)`
- Columns: name, description, steps (jsonb), status, created_at, updated_at

#### test_runs
- Primary key: `id` (uuid)
- Foreign key: `testcase_id` → `testcases(id)`
- Columns: status, started_at, completed_at, result_data (jsonb)

#### desktop_agents
- Primary key: `id` (uuid)
- Foreign key: `user_id` → `auth.users(id)`
- Columns: name, platform, status, last_seen

### Row Level Security (RLS)

All tables have RLS enabled with policies:
- Users can only access their own data
- Cascading permissions through relationships
- Separate policies for SELECT, INSERT, UPDATE, DELETE

## State Management

### Authentication State
- Managed by `AuthContext`
- Session persisted in Supabase
- Auto-refresh on page reload

### Data Fetching
- Direct Supabase client queries
- Real-time subscriptions (future)
- Optimistic updates for better UX

## Routing

### Public Routes
- `/login` - User login
- `/register` - User registration

### Protected Routes
- `/dashboard` - Main dashboard
- `/projects` - Project listing
- `/projects/new` - Create project
- `/projects/:id/edit` - Edit project
- `/testcases` - Test case listing
- `/testcases/new` - Create test case
- `/test-runs` - Test execution history
- `/auto-generate` - AI test generation
- `/desktop-agents` - Agent management

## Styling

### Tailwind CSS
- Utility-first CSS framework
- Custom color palette (primary blue tones)
- Responsive breakpoints
- Hover and focus states

### Design System
- Consistent spacing (4px, 8px, 16px, etc.)
- Color scheme: Blue primary, gray neutrals
- Typography: System fonts
- Components: Cards, buttons, forms, tables

## Performance Considerations

### Build Optimization
- Vite for fast bundling
- Code splitting by route
- Tree shaking for unused code
- Minification and compression

### Runtime Optimization
- Lazy loading of pages
- Memoization for expensive operations
- Debouncing for user input
- Pagination for large lists

## Security

### Authentication
- JWT-based authentication via Supabase
- Secure password hashing
- Session management
- Auto-logout on token expiry

### Data Access
- Row Level Security on all tables
- User-scoped queries
- Input validation
- XSS protection via React

## Future Architecture Enhancements

### Real-time Features
- Live test execution updates
- Collaborative editing
- Instant notifications

### Offline Support
- Service workers
- Local data caching
- Sync when online

### Advanced Features
- WebSocket for desktop agent communication
- File upload for test artifacts
- Export functionality
- Integration APIs
