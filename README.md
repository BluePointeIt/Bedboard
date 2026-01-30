# Bedboard - Hospital Bed Management System

A modern web application for tracking bed availability, patient assignments, and room status across hospital wards. Built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Dashboard** - Real-time overview of all beds with status indicators
- **Bed Management** - Assign/unassign patients, update bed status
- **Patient Tracking** - Basic patient information linked to beds
- **Real-time Updates** - All users see changes immediately via Supabase subscriptions
- **Search & Filter** - Find beds by ward, status, or patient name
- **PWA Support** - Installable on mobile devices and desktops
- **Demo Mode** - Works without Supabase for testing

## Quick Start

### Demo Mode (No Setup Required)

```bash
npm install
npm run dev
```

The app runs in demo mode with sample data when no Supabase credentials are configured.

### Production Setup with Supabase

1. Create a free Supabase project at [supabase.com](https://supabase.com)

2. Run the database schema in your Supabase SQL Editor:
   - Open `supabase/schema.sql`
   - Copy and paste into the SQL Editor
   - Run the script

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
bedboard/
├── src/
│   ├── components/      # Reusable UI components
│   ├── context/         # React context (Demo mode)
│   ├── hooks/           # Custom React hooks for data fetching
│   ├── lib/             # Supabase client, utilities, demo data
│   ├── pages/           # Main views (Dashboard, Beds, Patients, Settings)
│   └── types/           # TypeScript type definitions
├── public/              # Static assets, PWA manifest
├── supabase/            # Database schema
└── package.json
```

## Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and builds
- **Tailwind CSS 4** for styling
- **Supabase** for backend (PostgreSQL, Auth, Real-time)
- **Lucide React** for icons
- **React Router** for navigation

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Verification

1. Run locally with `npm run dev`
2. Open in two browser windows to test real-time updates
3. Test PWA installation on mobile device
4. Test across different screen sizes (responsive design)

## License

MIT
