import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch all tags for the authenticated user
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: tags, error } = await supabase
      .from('user_tags')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (error) throw error

    // Transform snake_case to camelCase for TypeScript
    const transformedTags = tags?.map((tag: any) => ({
      id: tag.id,
      userId: tag.user_id,
      name: tag.name,
      category: tag.category,
      color: tag.color,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at,
    })) || []

    return NextResponse.json({ tags: transformedTags })
  } catch (error) {
    console.error('Fetch tags error:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

// POST - Create a new tag
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, category, color } = await request.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    // Check if tag with this name already exists for this user
    const { data: existing } = await supabase
      .from('user_tags')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name.trim())
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 409 })
    }

    const { data: newTag, error } = await supabase
      .from('user_tags')
      .insert({
        user_id: user.id,
        name: name.trim(),
        category: category || null,
        color: color || null,
      })
      .select()
      .single()

    if (error) throw error

    // Transform snake_case to camelCase for TypeScript
    const transformedTag = newTag ? {
      id: newTag.id,
      userId: newTag.user_id,
      name: newTag.name,
      category: newTag.category,
      color: newTag.color,
      createdAt: newTag.created_at,
      updatedAt: newTag.updated_at,
    } : null

    return NextResponse.json({ tag: transformedTag }, { status: 201 })
  } catch (error) {
    console.error('Create tag error:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}
