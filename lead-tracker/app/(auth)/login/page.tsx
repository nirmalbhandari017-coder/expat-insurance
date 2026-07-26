"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { signIn, signUp } from "@/lib/actions/auth";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = mode === "signin" ? await signIn(formData) : await signUp(formData);
      if (res.ok) {
        if (mode === "signup") {
          toast.success("Account created. You can sign in now.");
          setMode("signin");
        } else {
          router.replace(next);
          router.refresh();
        }
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Expat Lead Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="full_name">Full name</label>
              <input id="full_name" name="full_name" type="text" autoComplete="name"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button type="submit" disabled={pending}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
            {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground">
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
