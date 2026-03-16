"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        window.location.href = "/";
      } else {
        if (password !== confirmPassword) {
          throw new Error("Las contraseñas no coinciden");
        }
        if (password.length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage("Cuenta creada. Revisa tu email para confirmar.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#0F0F0F] mb-4">
            <Sparkles className="w-6 h-6 text-[#D6F45B]" />
          </div>
          <h1 className="text-xl font-semibold text-[#0F0F0F]">
            Shopify Import Architect
          </h1>
          <p className="text-sm text-[#8C8C8C] mt-1">
            Catalogacion inteligente con IA
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
          {/* Tabs */}
          <div className="flex mb-6 bg-[#F5F6F7] rounded-lg p-1">
            <button
              onClick={() => { setIsLogin(true); setError(""); setMessage(""); }}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${
                isLogin
                  ? "bg-white text-[#0F0F0F] shadow-sm"
                  : "text-[#8C8C8C] hover:text-[#0F0F0F]"
              }`}
            >
              Iniciar Sesion
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(""); setMessage(""); }}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${
                !isLogin
                  ? "bg-white text-[#0F0F0F] shadow-sm"
                  : "text-[#8C8C8C] hover:text-[#0F0F0F]"
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#6B7280]">
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="h-10 border-[#E5E7EB]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#6B7280]">
                Contrasena
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-10 border-[#E5E7EB]"
              />
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#6B7280]">
                  Confirmar Contrasena
                </Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-10 border-[#E5E7EB]"
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            {message && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                {message}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-[#0F0F0F] hover:bg-[#2A2A2A] text-white rounded-full font-medium text-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLogin ? (
                "Entrar"
              ) : (
                "Crear Cuenta"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
