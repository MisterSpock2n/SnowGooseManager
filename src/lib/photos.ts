import type { SupabaseClient } from '@supabase/supabase-js'

export const PHOTO_BUCKET = 'maintenance-photos'
const MAX_DIMENSION = 1800

// Shrink phone photos before upload. Falls back to the original file if the
// browser can't decode it (e.g. HEIC on desktop Chrome).
export async function resizeImage(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) throw new Error('encode failed')
    return { blob, ext: 'jpg', type: 'image/jpeg' }
  } catch {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    return { blob: file, ext, type: file.type || 'image/jpeg' }
  }
}

export async function uploadMafPhotos(
  supabase: SupabaseClient,
  actionId: string,
  files: File[],
  kind: 'before' | 'after'
): Promise<{ uploaded: number; errors: string[] }> {
  const errors: string[] = []
  let uploaded = 0
  for (const file of files) {
    const { blob, ext, type } = await resizeImage(file)
    const path = `${actionId}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: type, upsert: false })
    if (upErr) {
      errors.push(`${file.name}: ${upErr.message}`)
      continue
    }
    const { error: rowErr } = await supabase.from('maintenance_photos').insert({ action_id: actionId, storage_path: path, kind })
    if (rowErr) {
      await supabase.storage.from(PHOTO_BUCKET).remove([path])
      errors.push(`${file.name}: ${rowErr.message}`)
      continue
    }
    uploaded++
  }
  return { uploaded, errors }
}
