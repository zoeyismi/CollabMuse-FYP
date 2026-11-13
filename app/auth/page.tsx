import { Suspense } from "react";
import { AuthWorkspace } from "@/components/AuthWorkspace";

export default function AuthPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-canvas" />}>
      <AuthWorkspace />
    </Suspense>
  );
}
