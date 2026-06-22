'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const magicLinkSchema = z.object({
  email: z.string().email(),
})

export async function signIn(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | never> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createDashboardServerClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: error.message }

  redirect('/dashboard')
}

export async function signUp(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createDashboardServerClient()
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${process.env['NEXT_PUBLIC_APP_URL']}/auth/callback` },
  })
  if (error) return { error: error.message }

  return { success: true }
}

export async function signOut(): Promise<never> {
  const supabase = await createDashboardServerClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

export async function sendMagicLink(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid email' }
  }

  const supabase = await createDashboardServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${process.env['NEXT_PUBLIC_APP_URL']}/auth/callback` },
  })
  if (error) return { error: error.message }

  return { success: true }
}

const updateProfileSchema = z.object({
  full_name: z.string().max(100).optional(),
  display_name: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
})

export async function updateUserProfile(
  formData: FormData,
): Promise<{ error: string } | { success: true }> {
  const parsed = updateProfileSchema.safeParse({
    full_name: formData.get('full_name') ?? undefined,
    display_name: formData.get('display_name') ?? undefined,
    phone: formData.get('phone') ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createDashboardServerClient()
  const { error } = await supabase.auth.updateUser({ data: parsed.data })
  if (error) return { error: error.message }

  return { success: true }
}
