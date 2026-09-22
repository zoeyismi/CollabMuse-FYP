import { Suspense } from "react";
import { AuthWorkspace } from "@/components/AuthWorkspace";

export default function AuthPage() {
  return (
    <Suspense fallback={<main className="auth-page min-h-screen" />}>
      <AuthWorkspace />
    </Suspense>
  );
}
