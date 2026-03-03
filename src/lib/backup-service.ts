
import { supabase } from './supabase';
import { ProcessedProduct } from './product-processor';

// ─── Types ───────────────────────────────────────────────────────

export interface ImportSession {
  id: string;
  device_id: string;
  file_name: string;
  file_hash: string | null;
  total_products: number;
  completed_products: number;
  failed_products: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface BackupData {
  products: ProcessedProduct[];
  session_id_ref: string;
  file_name: string;
  total_products: number;
  completed_count: number;
}

export interface SessionWithProducts {
  session: ImportSession;
  products: ProcessedProduct[];
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Simple hash for file content to detect re-uploads */
async function hashFileContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── BackupService ───────────────────────────────────────────────

export const BackupService = {

  // ──────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ──────────────────────────────────────────────────────────────

  /** Create a new import session ("flight") */
  async createSession(
    deviceId: string,
    fileName: string,
    totalProducts: number,
    fileContent?: string
  ): Promise<ImportSession | null> {
    try {
      const fileHash = fileContent ? await hashFileContent(fileContent) : null;

      const { data, error } = await supabase
        .from('import_sessions')
        .insert({
          device_id: deviceId,
          file_name: fileName,
          file_hash: fileHash,
          total_products: totalProducts,
          completed_products: 0,
          failed_products: 0,
          status: 'in_progress',
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      console.log('✈️ New flight session created:', data.id);
      return data as ImportSession;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  },

  /** Get the most recent active (in_progress) session for this device */
  async getActiveSession(deviceId: string): Promise<SessionWithProducts | null> {
    try {
      // 1. Find active session
      const { data: session, error: sessionError } = await supabase
        .from('import_sessions')
        .select('*')
        .eq('device_id', deviceId)
        .eq('status', 'in_progress')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!session) return null; // No active session

      // 2. Find the associated backup
      const { data: backup, error: backupError } = await supabase
        .from('backups')
        .select('*')
        .eq('session_id', deviceId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (backupError && backupError.code !== 'PGRST116') {
        throw backupError;
      }

      const products = (backup?.products as ProcessedProduct[]) || [];

      return {
        session: session as ImportSession,
        products,
      };
    } catch (error) {
      console.error('Error fetching active session:', error);
      return null;
    }
  },

  /** Mark session as completed */
  async completeSession(sessionId: string): Promise<void> {
    try {
      await supabase
        .from('import_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
      console.log('✅ Flight session completed:', sessionId);
    } catch (error) {
      console.error('Error completing session:', error);
    }
  },

  /** Mark session as abandoned */
  async abandonSession(sessionId: string): Promise<void> {
    try {
      await supabase
        .from('import_sessions')
        .update({
          status: 'abandoned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
      console.log('🗑️ Flight session abandoned:', sessionId);
    } catch (error) {
      console.error('Error abandoning session:', error);
    }
  },

  /** Get recent session history for this device */
  async getSessionHistory(deviceId: string, limit = 5): Promise<ImportSession[]> {
    try {
      const { data, error } = await supabase
        .from('import_sessions')
        .select('*')
        .eq('device_id', deviceId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as ImportSession[];
    } catch (error) {
      console.error('Error fetching session history:', error);
      return [];
    }
  },

  // ──────────────────────────────────────────────────────────────
  // CHECKPOINT (SAVE/RESTORE)
  // ──────────────────────────────────────────────────────────────

  /** Save a checkpoint: products snapshot + update session counters */
  async saveCheckpoint(
    deviceId: string,
    sessionId: string,
    products: ProcessedProduct[],
    fileName: string
  ): Promise<void> {
    try {
      const completed = products.filter(p => p.status === 'complete').length;
      const failed = products.filter(p => p.status === 'error').length;

      // 1. Upsert the backup (products snapshot)
      const { data: existing } = await supabase
        .from('backups')
        .select('id')
        .eq('session_id', deviceId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('backups')
          .update({
            products: products as any,
            session_id_ref: sessionId,
            file_name: fileName,
            total_products: products.length,
            completed_count: completed,
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', deviceId);
      } else {
        await supabase
          .from('backups')
          .insert({
            session_id: deviceId,
            session_id_ref: sessionId,
            products: products as any,
            file_name: fileName,
            total_products: products.length,
            completed_count: completed,
          });
      }

      // 2. Update session counters
      await supabase
        .from('import_sessions')
        .update({
          completed_products: completed,
          failed_products: failed,
          total_products: products.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      console.log(`💾 Checkpoint saved: ${completed}/${products.length} complete, ${failed} errors`);
    } catch (error) {
      console.error('Error saving checkpoint:', error);
    }
  },

  // ──────────────────────────────────────────────────────────────
  // LEGACY SUPPORT (backward compat with existing code)
  // ──────────────────────────────────────────────────────────────

  /** Legacy: Save backup (used by auto-save in page.tsx) */
  async saveBackup(sessionId: string, products: any[]) {
    try {
      const { data: existing } = await supabase
        .from('backups')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('backups')
          .update({
            products: products,
            updated_at: new Date().toISOString(),
          })
          .eq('session_id', sessionId);
      } else {
        await supabase
          .from('backups')
          .insert({
            session_id: sessionId,
            products: products,
          });
      }
      console.log('Backup saved successfully');
    } catch (error) {
      console.error('Error saving backup:', error);
    }
  },

  /** Legacy: Get backup by session ID */
  async getBackup(sessionId: string) {
    try {
      const { data, error } = await supabase
        .from('backups')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    } catch (error: any) {
      console.error('Error fetching backup:', error.message || error);
      return null;
    }
  },
};
