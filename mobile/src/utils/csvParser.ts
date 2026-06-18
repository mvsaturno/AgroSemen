export interface ParsedTouroCSV {
  nome: string;
  raca: string;
  empresaFornecedora: string;
  qtdConvencional: number;
  qtdSexadoMacho: number;
  qtdSexadoFemea: number;
}

export const parseCSV = (csvText: string): ParsedTouroCSV[] => {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) throw new Error("O arquivo está vazio ou não possui dados.");

  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';
  const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());

  const getIdx = (keywords: string[]) => {
    return headers.findIndex(h => keywords.some(kw => h.includes(kw)));
  };

  const idxNome = getIdx(['nome', 'touro', 'animal']);
  const idxRaca = getIdx(['raça', 'raca', 'breed']);
  const idxEmpresa = getIdx(['empresa', 'central', 'fornecedor']);
  const idxConv = getIdx(['convencional', 'conv']);
  const idxMacho = getIdx(['macho', 'sexado macho']);
  const idxFemea = getIdx(['fêmea', 'femea', 'sexado fêmea']);

  if (idxNome === -1) throw new Error("A coluna 'Nome' não foi encontrada. O CSV deve ter um cabeçalho com o nome do touro.");

  const results: ParsedTouroCSV[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Tratamento rudimentar de split
    const row = lines[i].split(delimiter).map(c => c.trim());
    if (row.length === 1 && row[0] === '') continue;

    const nome = row[idxNome] || '';
    if (!nome) continue; // ignora linhas onde o nome ta vazio

    results.push({
      nome: nome,
      raca: idxRaca !== -1 ? (row[idxRaca] || '') : '',
      empresaFornecedora: idxEmpresa !== -1 ? (row[idxEmpresa] || '') : '',
      qtdConvencional: idxConv !== -1 ? (parseInt(row[idxConv], 10) || 0) : 0,
      qtdSexadoMacho: idxMacho !== -1 ? (parseInt(row[idxMacho], 10) || 0) : 0,
      qtdSexadoFemea: idxFemea !== -1 ? (parseInt(row[idxFemea], 10) || 0) : 0,
    });
  }

  return results;
};
