# WortSchatz+ Setup Guide

## Prerequisites
- Node.js 18+ installed
- A Supabase account
- A Claude API key (from Anthropic)

## Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned
3. Go to Project Settings > API
4. Copy your project URL and anon/public key
5. Go to SQL Editor and run the contents of `supabase/schema.sql` to create the database schema

## Step 2: Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your Supabase credentials in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Import Sample Data (Optional)

The sample vocabulary data from `german_vocabulary_database.json` will be imported for Test_User_0 during development.

## Step 5: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 6: Create Your Account

1. Navigate to /signup
2. Create an account
3. Go to Profile settings
4. Add your Claude API key
5. Set your target daily learning time (default: 15 minutes)

## Database Schema Overview

- `profiles`: User settings and preferences
- `vocabulary`: Shared German vocabulary database
- `user_words`: User's personal dictionary entries
- `word_info_items`: Tracking for individual word attributes (gender, plural, etc.)
- `learning_sessions`: Learning session history
- `session_items`: Individual items practiced in sessions

## Key Features

- Word lookup with automatic root form identification
- Personal dictionary management
- Three learning modes: Revise, Recall, Practice
- Spaced repetition algorithm for optimal learning
- Granular tracking of word information items
- Responsive design for mobile, tablet, and desktop
