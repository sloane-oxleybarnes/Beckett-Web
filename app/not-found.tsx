import { RouteState } from "@/components/ui/RouteState";

export default function NotFound() {
  return (
    <RouteState
      title="Page not found"
      message="The page may have moved or the link may no longer be available."
      action={{ href: "/", label: "Go home" }}
    />
  );
}
