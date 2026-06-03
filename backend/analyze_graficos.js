const xlsx = require('xlsx');

const file = 'e:\\backup_notbook\\conta_azul_dashboard\\frontend\\Custos e Despesas - 2023 vs 2024 - GRAFICOS.xls';

try {
    const workbook = xlsx.readFile(file);
    const sheetName = 'GRAFICOS';
    
    if (!workbook.Sheets[sheetName]) {
        console.log("Aba 'Gráficos' não encontrada. Abas disponíveis:", workbook.SheetNames.join(', '));
        process.exit(1);
    }
    
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log(`--- Análise da Aba Gráficos ---\n`);
    json.forEach((row, idx) => {
        const cleanedRow = row.filter(cell => cell !== undefined && cell !== '').join(' | ');
        if (cleanedRow.trim() !== '') {
            console.log(`Linha ${idx + 1}: ${cleanedRow}`);
        }
    });

} catch (e) {
    console.error(`Erro ao ler ${file}:`, e.message);
}
