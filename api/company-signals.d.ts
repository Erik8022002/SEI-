export type CompanySignalsRequest = {
  ticker: string
  market: string
}

export function getCompanySignals(request: CompanySignalsRequest): Promise<unknown>

export default function handler(request: unknown, response: unknown): Promise<unknown>
