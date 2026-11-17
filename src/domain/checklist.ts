export const VERIFICATION_CHECKLIST: readonly { key: string; label: string }[] = [
  { key: 'client_data', label: 'Client data is complete and correct' },
  { key: 'scope_matches', label: 'Certification scope matches the request' },
  { key: 'results_consistent', label: 'Audit / inspection results are consistent' },
  { key: 'references_valid', label: 'Standards and references are valid and current' },
  { key: 'numbering_metadata', label: 'Document numbering and metadata are correct' },
  { key: 'impartiality', label: 'Impartiality and no conflict of interest confirmed' },
];
