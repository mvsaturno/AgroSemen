import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export const exportToCSV = async (data: Record<string, any>[], fileName: string) => {
  if (!data || data.length === 0) {
    throw new Error('Nenhum dado para exportar.');
  }

  // Obter os cabeçalhos a partir do primeiro objeto
  const headers = Object.keys(data[0]);
  
  // Mapear as linhas
  const rows = data.map(row => {
    return headers.map(header => {
      let val = row[header];
      if (val === null || val === undefined) val = '';
      
      // Tratar dados complexos ou textos
      val = String(val).replace(/"/g, '""'); // escapa aspas
      
      // Se tiver ponto e virgula ou quebra de linha, poe aspas em volta
      if (val.includes(';') || val.includes('\n') || val.includes(',')) {
        val = `"${val}"`;
      }
      return val;
    }).join(';');
  });

  // Bom para garantir UTF-8 no Excel (BOM = Byte Order Mark)
  const BOM = '\uFEFF';
  const csvString = BOM + [headers.join(';'), ...rows].join('\n');
  
  const safeFileName = fileName.replace(/[^a-zA-Z0-9-_\.]/g, '_');
  const fileUri = `${FileSystem.cacheDirectory}${safeFileName}.csv`;

  await FileSystem.writeAsStringAsync(fileUri, csvString, {
    encoding: FileSystem.EncodingType.UTF8
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Exportar Relatório CSV',
      UTI: 'public.comma-separated-values-text'
    });
  } else {
    throw new Error('O compartilhamento de arquivos não está disponível neste dispositivo.');
  }
};
