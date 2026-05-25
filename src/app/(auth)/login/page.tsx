import { ActivitySquare } from "lucide-react"

import { LoginForm } from "@/src/app/(auth)/login/_components/login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-brand p-4 sm:p-6">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl shadow-black/[0.12] sm:p-10">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-brand">
            <ActivitySquare className="size-5 text-gray-900" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Pulse
          </span>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
