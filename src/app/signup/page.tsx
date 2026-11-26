import { redirect } from "next/navigation";

/**
 * Farmers no longer sign themselves up: an Admin creates the account and the
 * Farmer sets a password from the emailed link. Old links land on sign-in.
 */
export default function SignupPage() {
  redirect("/login?role=farmer");
}
