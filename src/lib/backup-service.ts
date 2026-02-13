
import { supabase } from './supabase';

export interface BackupData {
  products: any[];
  sessionId: string;
}

export const BackupService = {
  // Save backup to Supabase
  async saveBackup(sessionId: string, products: any[]) {
    try {
      // Check if session exists
      const { data: existing } = await supabase
        .from('backups')
        .select('id')
        .eq('session_id', sessionId)
        .single();

      if (existing) {
        // Update existing backup
        await supabase
          .from('backups')
          .update({ 
            products: products, 
            updated_at: new Date().toISOString() 
          })
          .eq('session_id', sessionId);
      } else {
        // Create new backup
        await supabase
          .from('backups')
          .insert({ 
            session_id: sessionId, 
            products: products 
          });
      }
      console.log('Backup saved successfully');
    } catch (error) {
      console.error('Error saving backup:', error);
    }
  },

  // Get backup by session ID
  async getBackup(sessionId: string) {
    try {
      const { data, error } = await supabase
        .from('backups')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching backup:', error);
      return null;
    }
  },

  // Get most recent backup (for recovery on load)
  // Since we don't have auth yet, we might rely on localStorage for the last session ID
  // or just get the latest one if we implement a way to track the user
};
