"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button, Card, CardContent, Field, Input, ErrorNote } from "@/components/ui";
import { HardHat } from "lucide-react";

/**
 * Supabase Auth: email/password + Google (brief §3 — chosen because native
 * SDKs exist for the future iOS/Android apps). When Supabase isn't configured
 * (local dev with AUTH_MODE=dev) this page just points back to the app.
 */
export default function LoginPage() {
  const router = useRouter();
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const supabase = React.useMemo(
    () =>
      configured
        ? createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
        : null,
    [configured],
  );

  async function submit() {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/");
  }

  async function google() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-stone-100 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-center gap-2">
            <HardHat className="h-7 w-7 text-brand-600" />
            <span className="text-lg font-bold">Owner-Builder</span>
          </div>

          {!configured ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-stone-600">
                Supabase auth is not configured. In local development, set <code>AUTH_MODE=dev</code> in{" "}
                <code>.env.local</code> and you&apos;ll be signed in as the dev owner automatically.
              </p>
              <Button className="w-full" onClick={() => router.push("/")}>Continue</Button>
            </div>
          ) : (
            <>
              <Field label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </Field>
              <ErrorNote message={error} />
              <Button className="w-full" disabled={busy || !email || !password} onClick={submit}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
              <Button variant="outline" className="w-full" onClick={google}>
                Continue with Google
              </Button>
              <button
                className="w-full text-center text-xs text-stone-500 underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
