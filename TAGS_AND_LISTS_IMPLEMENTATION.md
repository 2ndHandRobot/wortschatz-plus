# Tags and Shareable Lists Implementation

## Overview

This document describes the implementation of two major features:
1. **User Tags** - Personal tagging system for organizing words
2. **Shareable Lists** - Create and share curated word lists

## Implementation Status

### ✅ Completed (Backend)

#### Database Schema
- [006_add_user_tags_system.sql](supabase/migrations/006_add_user_tags_system.sql)
  - `user_tags` table - User-created tags with categories and colors
  - `word_tags` table - Many-to-many relationship between user words and tags
  - RLS policies for user-scoped access

- [007_add_shareable_lists.sql](supabase/migrations/007_add_shareable_lists.sql)
  - `word_lists` table - User-created lists with share codes
  - `word_list_items` table - Words in each list
  - `word_list_access` table - Access control for collaborative features (future)
  - `generate_share_code()` function - Creates unique 10-character codes
  - RLS policies for public and private lists

#### TypeScript Types
- [types/vocabulary.ts](types/vocabulary.ts)
  - `UserTag`, `WordTag`, `TagCategory` interfaces
  - `WordList`, `WordListItem`, `WordListAccess`, `ListAccessType` interfaces

#### API Endpoints

**Tags:**
- `GET /api/tags` - Get all user's tags
- `POST /api/tags` - Create a new tag
- `GET /api/tags/[id]` - Get specific tag
- `PUT /api/tags/[id]` - Update tag
- `DELETE /api/tags/[id]` - Delete tag

**Word Tags:**
- `GET /api/words/[id]/tags` - Get tags for a word
- `POST /api/words/[id]/tags` - Add tag to word
- `DELETE /api/words/[id]/tags?tagId=...` - Remove tag from word

**Lists:**
- `GET /api/lists` - Get all user's lists with item counts
- `POST /api/lists` - Create a new list
- `GET /api/lists/[id]` - Get specific list with items
- `PUT /api/lists/[id]` - Update list
- `DELETE /api/lists/[id]` - Delete list

**List Items:**
- `POST /api/lists/[id]/items` - Add word to list
- `DELETE /api/lists/[id]/items?vocabularyId=...` - Remove word from list

**Sharing:**
- `POST /api/lists/[id]/share` - Generate share code and make public
- `DELETE /api/lists/[id]/share` - Remove share code and make private
- `GET /api/lists/shared/[code]` - View shared list by code
- `POST /api/lists/shared/[code]` - Import shared list to user's account

### 🚧 Pending (Frontend)

The following UI components still need to be implemented:

1. **Dictionary Page Updates**
   - Display tags on word cards
   - Tag filtering UI
   - "Add to list" buttons

2. **Tag Management UI**
   - Create/edit/delete tags
   - Assign colors and categories
   - Tag assignment interface

3. **Lists Page** (`/lists`)
   - View all lists
   - Create/edit/delete lists
   - Browse list contents

4. **Shared List View** (`/shared/[code]`)
   - Public-facing list view
   - Import list functionality
   - Read-only display of shared lists

## Database Schema Details

### User Tags

```sql
user_tags (
  id UUID PRIMARY KEY,
  user_id UUID → profiles(id),
  name TEXT UNIQUE per user,
  category TEXT ('thematic', 'situational', 'custom'),
  color TEXT (hex color),
  created_at, updated_at
)

word_tags (
  id UUID PRIMARY KEY,
  user_word_id UUID → user_words(id),
  tag_id UUID → user_tags(id),
  tagged_at TIMESTAMP,
  UNIQUE(user_word_id, tag_id)
)
```

### Shareable Lists

```sql
word_lists (
  id UUID PRIMARY KEY,
  user_id UUID → profiles(id),
  name TEXT,
  description TEXT,
  is_public BOOLEAN,
  share_code TEXT UNIQUE,
  language LANGUAGE,
  created_at, updated_at
)

word_list_items (
  id UUID PRIMARY KEY,
  list_id UUID → word_lists(id),
  vocabulary_id TEXT → vocabulary(id),
  added_at TIMESTAMP,
  added_by UUID → profiles(id),
  UNIQUE(list_id, vocabulary_id)
)
```

## Usage Examples

### Creating a Tag

```typescript
const response = await fetch('/api/tags', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Medical Terms',
    category: 'thematic',
    color: '#3B82F6'
  })
})
const { tag } = await response.json()
```

### Adding Tag to Word

```typescript
const response = await fetch(`/api/words/${userWordId}/tags`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tagId: 'tag-uuid' })
})
```

### Creating a List

```typescript
const response = await fetch('/api/lists', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Restaurant Vocabulary',
    description: 'Words for ordering food and dining out',
    language: 'german'
  })
})
const { list } = await response.json()
```

### Adding Word to List

```typescript
const response = await fetch(`/api/lists/${listId}/items`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ vocabularyId: 'noun-1234567890' })
})
```

### Sharing a List

```typescript
// Generate share code
const response = await fetch(`/api/lists/${listId}/share`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
})
const { shareCode, shareUrl } = await response.json()
// shareUrl will be like: https://yourapp.com/shared/abc123xyz
```

### Viewing Shared List

```typescript
const response = await fetch(`/api/lists/shared/${shareCode}`)
const { list } = await response.json()
// list.items contains all vocabulary words
// list.creator.name shows who created it
```

### Importing Shared List

```typescript
const response = await fetch(`/api/lists/shared/${shareCode}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
})
const { list } = await response.json()
// Creates a copy in user's account
```

## Security Features

### Row Level Security (RLS)

All tables have RLS policies ensuring:
- Users can only see/modify their own tags and lists
- Public lists are viewable by anyone but only editable by owner
- Word tags are scoped to user's words
- Cascading deletes prevent orphaned records

### Access Control

- Tags are completely user-scoped
- Lists have `is_public` flag for sharing control
- Share codes are unique and URL-safe
- Language validation prevents mixing languages in lists

## Next Steps

To complete the implementation, you need to:

1. **Run Migrations**
   ```bash
   # Apply database migrations to Supabase
   supabase db push
   ```

2. **Build Frontend Components**
   - Tag selector component (dropdown with colors)
   - Tag filter chips for dictionary
   - List management interface
   - Share link generator UI
   - Public list viewer page

3. **Update Existing Pages**
   - Add tag display to word cards in dictionary
   - Add "Add to list" action to words
   - Create `/lists` route
   - Create `/shared/[code]` route

4. **Testing**
   - Test tag CRUD operations
   - Test list sharing workflow
   - Verify RLS policies
   - Test import functionality

## Architecture Decisions

### Why User-Scoped Tags?
- Tags are personal organizational tools
- Different users may want same tag name with different meanings
- Simpler permission model
- Better privacy

### Why Share by Code?
- Simple to implement (Option A from planning)
- No complex user management
- Works for anonymous viewers
- Easy to revoke (delete share_code)

### Why Reference Vocabulary Table?
- Single source of truth for word data
- Lists don't duplicate data
- Updates to vocabulary reflect in all lists
- Efficient storage

### Language Validation
- Lists are language-specific
- Prevents mixing German and French words
- Matches user workflow (studying one language at a time)
- Cleaner UX

## Future Enhancements

Consider adding later:
- Collaborative lists (using `word_list_access` table)
- Tag analytics (most used tags, tag-based statistics)
- List templates (common starter lists)
- Tag suggestions based on word content
- Bulk tagging operations
- Export lists to CSV/Anki
