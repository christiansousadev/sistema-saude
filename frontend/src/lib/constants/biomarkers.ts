export interface BiomarkerDef {
  name: string
  unit: string
  reference: string
  category: string
}

export const BIOMARKERS: BiomarkerDef[] = [
  // hemograma
  { name: 'Hemoglobina',      unit: 'g/dL',   reference: 'H: 13,5-17,5 / M: 12-16',  category: 'Hemograma' },
  { name: 'Hematócrito',      unit: '%',       reference: 'H: 41-53 / M: 36-46',      category: 'Hemograma' },
  { name: 'Leucócitos',       unit: '/mm³',    reference: '4.500 – 11.000',            category: 'Hemograma' },
  { name: 'Plaquetas',        unit: '/mm³',    reference: '150.000 – 400.000',         category: 'Hemograma' },

  // glicemia
  { name: 'Glicemia em Jejum', unit: 'mg/dL',  reference: '70 – 99',                  category: 'Glicemia' },
  { name: 'HbA1c',            unit: '%',       reference: '< 5,7',                    category: 'Glicemia' },

  // lipídios
  { name: 'Colesterol Total',  unit: 'mg/dL',  reference: '< 200',                    category: 'Lipídios' },
  { name: 'HDL',               unit: 'mg/dL',  reference: 'H: > 40 / M: > 50',        category: 'Lipídios' },
  { name: 'LDL',               unit: 'mg/dL',  reference: '< 130',                    category: 'Lipídios' },
  { name: 'Triglicerídeos',    unit: 'mg/dL',  reference: '< 150',                    category: 'Lipídios' },

  // tireoide
  { name: 'TSH',               unit: 'mUI/L',  reference: '0,4 – 4,0',               category: 'Tireoide' },
  { name: 'T4 Livre',          unit: 'ng/dL',  reference: '0,8 – 1,9',               category: 'Tireoide' },

  // função renal
  { name: 'Creatinina',        unit: 'mg/dL',  reference: 'H: 0,7-1,2 / M: 0,5-1,0', category: 'Função Renal' },
  { name: 'Ureia',             unit: 'mg/dL',  reference: '20 – 50',                  category: 'Função Renal' },

  // função hepática
  { name: 'TGO (AST)',         unit: 'U/L',    reference: '≤ 40',                     category: 'Função Hepática' },
  { name: 'TGP (ALT)',         unit: 'U/L',    reference: '≤ 40',                     category: 'Função Hepática' },

  // vitaminas e minerais
  { name: 'Vitamina D',        unit: 'ng/mL',  reference: '30 – 100',                 category: 'Vitaminas' },
  { name: 'Vitamina B12',      unit: 'pg/mL',  reference: '200 – 900',                category: 'Vitaminas' },
  { name: 'Ferritina',         unit: 'ng/mL',  reference: 'H: 30-400 / M: 15-150',    category: 'Vitaminas' },

  // inflamação
  { name: 'PCR',               unit: 'mg/L',   reference: '< 10',                     category: 'Inflamação' },
]

export const BIOMARKER_CATEGORIES = [...new Set(BIOMARKERS.map((b) => b.category))]
