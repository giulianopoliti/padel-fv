'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getAllServices() {
    const supabase = await createClient();
    const { data, error } = await supabase.from('services').select('*');
    if (error) {
        throw new Error(error.message);
    }
    return data;
}