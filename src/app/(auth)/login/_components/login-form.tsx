"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, Loader2 } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { AlertDestructive } from "@/src/components/alerts/alertDestructive";

type LoginType = {
  email: string;
  password: string;
};

export function LoginForm({ className }: { className?: string }) {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginType>();

  const loginMutation = useMutation({
    mutationFn: async (data: LoginType) => {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, rememberMe }),
      });
      const json = await res.json();
      if (!res.ok) throw json;
      return json;
    },
    onSuccess: () => {
      setIsRedirecting(true);
      router.push("/dashboard");
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message ?? "Something went wrong");
    },
  });

  const isLoading = loginMutation.isPending || isRedirecting;

  const onSubmit = (data: LoginType) => {
    setFormError(null);
    loginMutation.mutate(data);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={cn("flex flex-col gap-5", className)}
    >
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your workspace to view today&apos;s activity.
        </p>
      </div>

      {formError && <AlertDestructive title={formError} />}

      {/* Fields */}
      <div className="mt-1 flex flex-col gap-3">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              disabled={isLoading}
              className={cn(
                "h-12 w-full rounded-xl border-0 bg-muted pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand focus:ring-offset-0 disabled:opacity-50",
                errors.email && "ring-2 ring-destructive",
              )}
              {...register("email", {
                required: "Email address is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email address",
                },
              })}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Password
            </label>
            <a
              href="#"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Forgot?
            </a>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              disabled={isLoading}
              className={cn(
                "h-12 w-full rounded-xl border-0 bg-muted pl-10 pr-14 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand focus:ring-offset-0 disabled:opacity-50",
                errors.password && "ring-2 ring-destructive",
              )}
              {...register("password", {
                required: "Password is required",
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me */}
        <button
          type="button"
          role="checkbox"
          aria-checked={rememberMe}
          onClick={() => setRememberMe((v) => !v)}
          className="flex w-fit items-center gap-2.5"
        >
          <div
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-all",
              rememberMe
                ? "border-brand bg-brand"
                : "border-border bg-background",
            )}
          >
            {rememberMe && (
              <div className="size-1.5 rounded-full bg-foreground" />
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            Keep me signed in for 30 days
          </span>
        </button>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
      >
        {isRedirecting ? "Preparing dashboard…" : isLoading ? "Signing in…" : "Sign in to dashboard"}
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowRight className="size-4" />
        )}
      </button>
    </form>
  );
}
