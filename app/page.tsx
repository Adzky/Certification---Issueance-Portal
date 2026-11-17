import { redirect } from "next/navigation";

/** `/`: the proxy sends signed-out visitors to /login; signed-in users land on their dashboard. */
export default function Home() {
  redirect("/dashboard");
}
