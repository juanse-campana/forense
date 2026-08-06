"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, ExternalLink, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Severity, ThirdPartyLibrary, LibraryVulnerability } from "@/lib/api";

// La severidad mostrada sale del CVSS oficial del NVD cuando esta disponible;
// sin el, no se inventa una severidad a partir del vector CVSS de OSV (es un
// vector, no una etiqueta) - se muestra "-" como en el resto de la UI.
function vulnSeverity(vuln: LibraryVulnerability): Severity | null {
  const s = vuln.nvd?.cvss_severity?.toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") {
    return s;
  }
  return null;
}

const severityRank: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function libraryWorstSeverity(lib: ThirdPartyLibrary): Severity | null {
  let worst: Severity | null = null;
  for (const vuln of lib.vulnerabilities ?? []) {
    const sev = vulnSeverity(vuln);
    if (sev && (worst === null || severityRank[sev] < severityRank[worst])) {
      worst = sev;
    }
  }
  return worst;
}

function VulnerabilityDetail({ vuln }: { vuln: LibraryVulnerability }) {
  const t = useTranslations();
  const severity = vulnSeverity(vuln);
  const references = (vuln.references ?? []).slice(0, 3);

  return (
    <div className="rounded bg-surface-container-high p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-medium text-on-surface">{vuln.id}</span>
        {severity ? (
          <Badge variant={severity}>
            {t(`severity.${severity}`)}
            {vuln.nvd?.cvss_score != null && (
              <span className="ml-1 opacity-80">{vuln.nvd.cvss_score.toFixed(1)}</span>
            )}
          </Badge>
        ) : (
          <span className="text-xs text-on-surface-variant">-</span>
        )}
        {vuln.fixed_version && (
          <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-medium text-secondary">
            {t("results.libraries.updateTo", { version: vuln.fixed_version })}
          </span>
        )}
      </div>
      {(vuln.summary || vuln.nvd?.description) && (
        <p className="mt-2 text-xs text-on-surface-variant">
          {vuln.nvd?.description || vuln.summary}
        </p>
      )}
      {references.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {references.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
            >
              <ExternalLink size={12} />
              {new URL(url).hostname}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function LibrariesTab({ libraries }: { libraries: ThirdPartyLibrary[] }) {
  const t = useTranslations();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (libraries.length === 0) {
    return (
      <div className="rounded bg-surface py-12 text-center text-on-surface-variant outline outline-1 outline-outline-variant">
        {t("results.libraries.empty")}
      </div>
    );
  }

  return (
    <div className="rounded bg-surface outline outline-1 outline-outline-variant">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>{t("results.libraries.package")}</TableHead>
            <TableHead>{t("results.version")}</TableHead>
            <TableHead>{t("results.libraries.cves")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {libraries.map((lib, index) => {
            const vulns = lib.vulnerabilities ?? [];
            const isExpanded = expanded === lib.package_name;
            const worst = libraryWorstSeverity(lib);
            return (
              <React.Fragment key={lib.package_name}>
                <TableRow
                  className={`cursor-pointer ${index % 2 === 1 ? "bg-surface-container-low/50" : ""}`}
                  onClick={() => setExpanded(isExpanded ? null : lib.package_name)}
                >
                  <TableCell>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 font-mono text-xs">
                      <Package size={14} className="text-on-surface-variant" />
                      {lib.package_name}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{lib.version}</TableCell>
                  <TableCell>
                    {vulns.length > 0 ? (
                      <Badge variant={worst ?? "medium"}>
                        {t("results.libraries.cveCount", { count: vulns.length })}
                      </Badge>
                    ) : (
                      <span className="text-xs text-secondary">
                        {t("results.libraries.noCves")}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className={index % 2 === 1 ? "bg-surface-container-low/50" : ""}>
                    <TableCell colSpan={4}>
                      <div className="space-y-2 py-2">
                        {vulns.map((vuln) => (
                          <VulnerabilityDetail key={vuln.id} vuln={vuln} />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
