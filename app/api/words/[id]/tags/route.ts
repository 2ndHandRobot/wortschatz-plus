import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch all tags for a specific user word
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the user_word belongs to the user
    const { data: userWord } = await supabase
      .from('user_words')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!userWord) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 })
    }

    // Fetch tags for this word with tag details
    const { data: wordTags, error } = await supabase
      .from('word_tags')
      .select(`
        id,
        user_word_id,
        tag_id,
        tagged_at,
        tag:user_tags (
          id,
          user_id,
          name,
          category,
          color,
          created_at,
          updated_at
        )
      `)
      .eq('user_word_id', id)
      .order('tagged_at', { ascending: false })

    if (error) throw error

    // Transform snake_case to camelCase for TypeScript
    const transformedWordTags = wordTags?.map((wt: any) => {
      const tagData = Array.isArray(wt.tag) ? wt.tag[0] : wt.tag
      return {
        id: wt.id,
        userWordId: wt.user_word_id,
        tagId: wt.tag_id,
        taggedAt: wt.tagged_at,
        tag: tagData ? {
          id: tagData.id,
          userId: tagData.user_id,
          name: tagData.name,
          category: tagData.category,
          color: tagData.color,
          createdAt: tagData.created_at,
          updatedAt: tagData.updated_at,
        } : undefined
      }
    }) || []

    return NextResponse.json({ wordTags: transformedWordTags })
  } catch (error) {
    console.error('Fetch word tags error:', error)
    return NextResponse.json({ error: 'Failed to fetch word tags' }, { status: 500 })
  }
}

// POST - Add a tag to a word
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tagId } = await request.json()

    if (!tagId) {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 })
    }

    // Verify the user_word belongs to the user
    const { data: userWord } = await supabase
      .from('user_words')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!userWord) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 })
    }

    // Verify the tag belongs to the user
    const { data: tag } = await supabase
      .from('user_tags')
      .select('id')
      .eq('id', tagId)
      .eq('user_id', user.id)
      .single()

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // Check if tag is already applied to this word
    const { data: existing } = await supabase
      .from('word_tags')
      .select('id')
      .eq('user_word_id', id)
      .eq('tag_id', tagId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Tag already applied to this word' }, { status: 409 })
    }

    // Add the tag to the word
    const { data: wordTag, error } = await supabase
      .from('word_tags')
      .insert({
        user_word_id: id,
        tag_id: tagId,
      })
      .select(`
        id,
        user_word_id,
        tag_id,
        tagged_at,
        tag:user_tags (
          id,
          user_id,
          name,
          category,
          color,
          created_at,
          updated_at
        )
      `)
      .single()

    if (error) throw error

    // Transform snake_case to camelCase for TypeScript
    const tagData = wordTag && wordTag.tag ? (Array.isArray(wordTag.tag) ? wordTag.tag[0] : wordTag.tag) : null
    const transformedWordTag = wordTag ? {
      id: wordTag.id,
      userWordId: wordTag.user_word_id,
      tagId: wordTag.tag_id,
      taggedAt: wordTag.tagged_at,
      tag: tagData ? {
        id: tagData.id,
        userId: tagData.user_id,
        name: tagData.name,
        category: tagData.category,
        color: tagData.color,
        createdAt: tagData.created_at,
        updatedAt: tagData.updated_at,
      } : undefined
    } : null

    return NextResponse.json({ wordTag: transformedWordTag }, { status: 201 })
  } catch (error) {
    console.error('Add word tag error:', error)
    return NextResponse.json({ error: 'Failed to add tag to word' }, { status: 500 })
  }
}

// DELETE - Remove a tag from a word (by tag_id query param)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tagId = searchParams.get('tagId')

    if (!tagId) {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 })
    }

    // Verify the user_word belongs to the user
    const { data: userWord } = await supabase
      .from('user_words')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!userWord) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 })
    }

    // Delete the word_tag relationship
    const { error } = await supabase
      .from('word_tags')
      .delete()
      .eq('user_word_id', id)
      .eq('tag_id', tagId)

    if (error) throw error

    return NextResponse.json({ message: 'Tag removed from word successfully' })
  } catch (error) {
    console.error('Remove word tag error:', error)
    return NextResponse.json({ error: 'Failed to remove tag from word' }, { status: 500 })
  }
}
