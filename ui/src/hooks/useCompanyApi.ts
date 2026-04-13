import { useMemo } from "react";
import { companyApi } from "../api/client";
import { useCompany } from "../context/CompanyContext";

/**
 * Returns a company-scoped API client using the currently selected company.
 * Throws if no company is selected.
 */
export function useCompanyApi() {
  const { selectedCompanyId } = useCompany();
  if (!selectedCompanyId) {
    throw new Error("useCompanyApi: no company selected");
  }
  return useMemo(() => companyApi(selectedCompanyId), [selectedCompanyId]);
}
