"use client"

import { useState } from "react"
import { ArrowRight, Lock, Mail } from "lucide-react"

import { cn } from "@/src/lib/utils"

export function LoginForm({ className }: { className?: string }) {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  return (
    <form className={cn("flex flex-col gap-5", className)}>
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your workspace to view today&apos;s activity.
        </p>
      </div>

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
              required
              className="h-12 w-full rounded-xl border-0 bg-muted pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand focus:ring-offset-0"
            />
          </div>
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
              required
              className="h-12 w-full rounded-xl border-0 bg-muted pl-10 pr-14 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand focus:ring-offset-0"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
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
                : "border-border bg-background"
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
        className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.98]"
      >
        Sign in to dashboard
        <ArrowRight className="size-4" />
      </button>
    </form>
  )
}
