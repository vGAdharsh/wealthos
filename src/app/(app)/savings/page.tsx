import { PlannedModule } from "@/components/ui";

const capabilities = "".split("; ").map((c) => c.trim());

export default function Page() {
  return (
    <PlannedModule
      title="Savings"
      phase="Phase 2"
      summary="This module is part of the approved WealthOS roadmap and becomes functional when its phase lands. Nothing on this page is simulated."
      capabilities={capabilities}
    />
  );
}
