export const BUNDESLAENDER: Record<string, string> = {
  BB: 'Brandenburg',
  BE: 'Berlin',
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  HB: 'Bremen',
  HE: 'Hessen',
  HH: 'Hamburg',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SH: 'Schleswig-Holstein',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  TH: 'Thüringen',
}

export function getBundeslandName(code: string): string {
  return BUNDESLAENDER[code.toUpperCase()] ?? code
}

export const DEFAULT_BUNDESLAND = 'NW'
