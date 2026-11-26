import { Suspense } from "react";

import { SetPasswordView } from "@/components/auth/set-password-view";

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordView />
    </Suspense>
  );
}
