"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";

export interface UserSettings {
  shopify_domain: string;
  shopify_access_token: string;
  shopify_api_version: string;
  shopify_shop_name: string;
  shopify_products_count: number;
  ai_provider: string;
  ai_api_key: string;
  ai_gemini_model: string;
  ai_openai_model: string;
  fragella_api_key: string;
  default_inventory_qty: number;
  publication_mode: string;
  publication_ids: string[];
  output_mode: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  shopify_domain: "",
  shopify_access_token: "",
  shopify_api_version: "2025-01",
  shopify_shop_name: "",
  shopify_products_count: 0,
  ai_provider: "gemini",
  ai_api_key: "",
  ai_gemini_model: "gemini-2.5-flash",
  ai_openai_model: "gpt-4o-mini",
  fragella_api_key: "",
  default_inventory_qty: 10,
  publication_mode: "all",
  publication_ids: [],
  output_mode: "csv_only",
};

export function useUserSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        // Try migrating from localStorage (first-time login)
        const migrated = migrateFromLocalStorage();
        if (migrated) {
          await supabase
            .from("user_settings")
            .upsert({ user_id: user.id, ...migrated });
          setSettings({ ...DEFAULT_SETTINGS, ...migrated });
        }
      } else {
        setSettings({
          shopify_domain: data.shopify_domain || "",
          shopify_access_token: data.shopify_access_token || "",
          shopify_api_version: data.shopify_api_version || "2025-01",
          shopify_shop_name: data.shopify_shop_name || "",
          shopify_products_count: data.shopify_products_count || 0,
          ai_provider: data.ai_provider || "gemini",
          ai_api_key: data.ai_api_key || "",
          ai_gemini_model: data.ai_gemini_model || "gemini-2.5-flash",
          ai_openai_model: data.ai_openai_model || "gpt-4o-mini",
          fragella_api_key: data.fragella_api_key || "",
          default_inventory_qty: data.default_inventory_qty || 10,
          publication_mode: data.publication_mode || "all",
          publication_ids: data.publication_ids || [],
          output_mode: data.output_mode || "csv_only",
        });
      }
      setLoading(false);
    };

    load();
  }, [user, supabase]);

  const updateSettings = useCallback(
    async (partial: Partial<UserSettings>) => {
      if (!user) return;
      setSettings((prev) => ({ ...prev, ...partial }));
      await supabase
        .from("user_settings")
        .update({ ...partial, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
    },
    [user, supabase]
  );

  return { settings, loading, updateSettings };
}

/** One-time migration from localStorage to Supabase */
function migrateFromLocalStorage(): Partial<UserSettings> | null {
  if (typeof window === "undefined") return null;

  const domain = localStorage.getItem("shopify_shop_domain");
  if (!domain) return null;

  const migrated: Partial<UserSettings> = {
    shopify_domain: domain || "",
    shopify_access_token: localStorage.getItem("shopify_access_token") || "",
    shopify_api_version: localStorage.getItem("shopify_api_version") || "2025-01",
    shopify_shop_name: localStorage.getItem("shopify_shop_name") || "",
    ai_provider: localStorage.getItem("ai_provider") || "gemini",
    ai_api_key: localStorage.getItem("ai_api_key") || "",
    ai_gemini_model: localStorage.getItem("ai_gemini_model_version") || "gemini-2.5-flash",
    ai_openai_model: localStorage.getItem("ai_openai_model_version") || "gpt-4o-mini",
    fragella_api_key: localStorage.getItem("fragella_api_key") || "",
    default_inventory_qty: Number(localStorage.getItem("shopify_default_inventory_qty") || "10"),
    publication_mode: localStorage.getItem("shopify_publication_mode") || "all",
    output_mode: localStorage.getItem("shopify_output_mode") || "csv_only",
  };

  // Clear localStorage after migration
  const keysToRemove = [
    "shopify_shop_domain", "shopify_access_token", "shopify_api_version",
    "shopify_shop_name", "shopify_products_count", "shopify_connected",
    "shopify_profile_name", "shopify_output_mode", "shopify_default_inventory_qty",
    "shopify_publication_mode", "shopify_publication_ids", "shopify_publications_cache",
    "ai_provider", "ai_api_key", "ai_model_version",
    "ai_gemini_model_version", "ai_openai_model_version", "fragella_api_key"
  ];
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  return migrated;
}
