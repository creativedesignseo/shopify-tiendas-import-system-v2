import { supabase, isSupabaseConfigured } from './supabase';

export interface AuditLog {
  product_id: string; // ID global de Shopify
  status: 'audited' | 'skipped' | 'failed';
  diff_summary: string;
}

export const AuditorDB = {
  /**
   * Registra o actualiza el estado de auditoría de un producto.
   */
  async trackAudit(log: AuditLog): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase.from('audit_logs').upsert({
        product_id: log.product_id,
        status: log.status,
        diff_summary: log.diff_summary,
        updated_at: new Date().toISOString()
      }, { onConflict: 'product_id' });

      if (error) console.error("Error al guardar audit:", error.message);
    } catch(e) {
      console.error("Supabase Audit Log Error:", e);
    }
  },

  /**
   * Obtiene la lista de IDs de productos que ya han sido auditados, 
   * para poder saltarlos en el proximo lote.
   */
  async getAuditedProductIds(): Promise<Set<string>> {
    if (!isSupabaseConfigured) return new Set();
    try {
      const { data, error } = await supabase.from('audit_logs').select('product_id');
      if (error) throw error;
      const ids = (data || []).map(r => r.product_id);
      return new Set(ids);
    } catch(e) {
      console.error("Supabase fetch audit error:", e);
      return new Set();
    }
  },
  
  /**
   * Obtiene estadisticas generales de auditoría.
   */
  async getStats(): Promise<{ total_audited: number; total_failed: number }> {
    if (!isSupabaseConfigured) return { total_audited: 0, total_failed: 0 };
    try {
       const { data, error } = await supabase.from('audit_logs').select('status');
       if (error) throw error;
       let audited = 0;
       let failed = 0;
       (data || []).forEach(r => {
           if (r.status === 'audited') audited++;
           if (r.status === 'failed') failed++;
       });
       return { total_audited: audited, total_failed: failed };
    } catch (e) {
       return { total_audited: 0, total_failed: 0 };
    }
  }
};
