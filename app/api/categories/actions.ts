'use server';

import { Category } from '@/types';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';


export async function getCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*');
  if (error) throw error;
  return data;
}

export async function getCategoryByName(name: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*').eq('name', name);
  if (error) throw error;
  return data as unknown as Category;
}

