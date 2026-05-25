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
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Welcome back
        </h1>
        <p className="text-sm text-gray-400">
          Sign in to your workspace to view today&apos;s activity.
        </p>
      </div>

      {/* Fields */}
      <div className="mt-1 flex flex-col gap-3">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-[11px] font-semibold uppercase tracking-widest text-gray-400"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              required
              className="h-12 w-full rounded-xl border-0 bg-gray-100 pl-10 pr-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-brand focus:ring-offset-0"
            />
          </div>
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-[11px] font-semibold uppercase tracking-widest text-gray-400"
            >
              Password
            </label>
            <a
              href="#"
              className="text-xs font-medium text-gray-400 hover:text-gray-900"
            >
              Forgot?
            </a>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              className="h-12 w-full rounded-xl border-0 bg-gray-100 pl-10 pr-14 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand focus:ring-offset-0"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-gray-900"
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
                : "border-gray-200 bg-white"
            )}
          >
            {rememberMe && (
              <div className="size-1.5 rounded-full bg-gray-900" />
            )}
          </div>
          <span className="text-sm text-gray-500">
            Keep me signed in for 30 days
          </span>
        </button>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gray-900 text-sm font-semibold text-white transition-colors hover:bg-gray-800 active:scale-[0.98]"
      >
        Sign in to dashboard
        <ArrowRight className="size-4" />
      </button>
    </form>
  )
}
