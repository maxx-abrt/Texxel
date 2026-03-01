# A2E Thread

A connected workspace for notes, tasks, projects, and team collaboration. Built for how modern teams actually work — fast, real-time, and collaborative.

Powered by Convex (real-time backend), Neon Auth (authentication), and EdgeStore (file storage).

## Features

### Notes & Docs
- Rich block-based editor (BlockNote)
- Infinite nested documents
- Drag-and-drop reordering
- Customizable icons and cover images
- Publish documents to the web
- Trash with soft delete and recovery

### Tasks & Projects
- Create and assign tasks with priorities and due dates
- Kanban-style project boards
- Task comments and status tracking
- Filter and group by status, priority, assignee

### Teams & Collaboration
- Create team workspaces with roles (Owner, Admin, Member)
- Invite members by email
- Shared projects and documents per team
- Real-time updates across all team members

### Inbox & Notifications
- Unified inbox for all activity
- Notifications for assignments, mentions, comments
- Mark read / clear all

### Auth & Onboarding
- Email + OTP sign-in via Neon Auth
- Password reset flow
- Multi-step onboarding (role, use case, team setup)
- Secure session management

### UX
- Light and dark mode
- Fully responsive
- Fast search (Cmd+K)

## Technologies

![NextJS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![Shadcn-ui](https://img.shields.io/badge/shadcn/ui-000000.svg?style=for-the-badge&logo=shadcn/ui&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=TypeScript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC.svg?style=for-the-badge&logo=Tailwind-CSS&logoColor=white)
![Convex](https://img.shields.io/badge/Convex-ee342f.svg?style=for-the-badge&logo=Convex&logoColor=white)
![Edgestore](https://img.shields.io/badge/Edgestore-a57fff.svg?style=for-the-badge&logo=Edgestore&logoColor=white)
![Blocknote](https://img.shields.io/badge/Blocknote-ff8c00.svg?style=for-the-badge&logo=Blocknote&logoColor=white)
![dnd-kit](https://img.shields.io/badge/dnd--kit-000000?style=for-the-badge&logo=react&logoColor=white)

## Installation

1. Clone the repository
2. Install the dependencies

```
npm install
```

3. Set up the environment variables

```
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Neon Auth
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=
NEON_AUTH_JWKS_URL=

# EdgeStore
EDGE_STORE_ACCESS_KEY=
EDGE_STORE_SECRET_KEY=

# For deploying
CONVEX_DEPLOY_KEY=
```

See [Neon Auth docs](https://neon.tech/docs/guides/neon-auth) to get your auth credentials.
See [Convex auth config](https://docs.convex.dev/auth/overview) to configure the JWKS provider.

4. Run Convex

```
npx convex dev
```

5. Run the development server

```
npm run dev
```

## License

MIT
