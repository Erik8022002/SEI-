declare module './generated/investor-conferences.json' {
  const value: {
    generatedAt: string
    source: { name: string; url: string; years: number[] }
    conferences: Array<Record<string, unknown>>
    companies?: Array<{ code: string; name: string; conferenceCount: number; group?: string; note?: string }>
  }
  export default value
}
