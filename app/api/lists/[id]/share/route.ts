import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Generate or regenerate a share code for a list
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

    // Verify the list belongs to the user
    const { data: list } = await supabase
      .from('word_lists')
      .select('id, share_code')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!list) {
      return NextResponse.json({ error: 'List not found or unauthorized' }, { status: 404 })
    }

    // If list already has a share code, return it unless regenerate is requested
    const { regenerate } = await request.json()

    // Get the origin from the request headers
    const host = request.headers.get('host')
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const origin = `${protocol}://${host}`

    if (list.share_code && !regenerate) {
      // Fetch the full list details to return
      const { data: fullList } = await supabase
        .from('word_lists')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      return NextResponse.json({
        shareCode: list.share_code,
        shareUrl: `${origin}/shared/${list.share_code}`,
        list: fullList,
      })
    }

    // Generate a new unique share code
    let shareCode: string
    let isUnique = false
    let attempts = 0
    const maxAttempts = 10

    while (!isUnique && attempts < maxAttempts) {
      // Call the database function to generate share code
      const { data: codeData } = await supabase.rpc('generate_share_code')
      shareCode = codeData as string

      // Check if code is unique
      const { data: existing } = await supabase
        .from('word_lists')
        .select('id')
        .eq('share_code', shareCode)
        .single()

      if (!existing) {
        isUnique = true
      }
      attempts++
    }

    if (!isUnique) {
      return NextResponse.json({ error: 'Failed to generate unique share code' }, { status: 500 })
    }

    // Update the list with the share code and make it public
    const { data: updatedList, error } = await supabase
      .from('word_lists')
      .update({
        share_code: shareCode!,
        is_public: true,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      shareCode: updatedList.share_code,
      shareUrl: `${origin}/shared/${updatedList.share_code}`,
      list: updatedList,
    })
  } catch (error) {
    console.error('Generate share code error:', error)
    return NextResponse.json({ error: 'Failed to generate share code' }, { status: 500 })
  }
}

// DELETE - Remove share code and make list private
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

    // Update the list to remove share code and make private
    const { data: updatedList, error } = await supabase
      .from('word_lists')
      .update({
        share_code: null,
        is_public: false,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !updatedList) {
      return NextResponse.json({ error: 'List not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Share link removed, list is now private',
      list: updatedList,
    })
  } catch (error) {
    console.error('Remove share code error:', error)
    return NextResponse.json({ error: 'Failed to remove share code' }, { status: 500 })
  }
}
