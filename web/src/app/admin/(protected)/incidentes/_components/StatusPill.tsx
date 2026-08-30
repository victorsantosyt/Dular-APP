import { Badge, incidenteStatusTone, rotuloEnum } from "@/design-system/ui";

/** Mantido como wrapper fino: a escala de cor vive em design-system/ui/priority. */
export function StatusPill({ status }: { status: string }) {
  return <Badge tone={incidenteStatusTone(status)}>{rotuloEnum(status?.toUpperCase())}</Badge>;
}
