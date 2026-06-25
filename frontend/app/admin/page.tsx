import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  // Redirect to the login page by default. 
  // If they are logged in, the login page typically handles redirecting them to the dashboard.
  redirect("/admin/login");
}
