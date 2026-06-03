const xlsx = require('xlsx');
const path = require('path');

const files = [
    'e:\\backup_notbook\\conta_azul_dashboard\\frontend\\Custos e Despesas - 2023 vs 2024 - GRAFICOS.xls',
    'e:\\backup_notbook\\conta_azul_dashboard\\frontend\\CONTAS A RECEBER - EM ATRASO - SP - BASE 20-02-2026.xlsx'
];

files.forEach(file => {
    console.log(`\n================================`);
    console.log(`Arquivo: ${path.basename(file)}`);
    console.log(`================================`);
    try {
        const workbook = xlsx.readFile(file);
        console.log(`Sheets: ${workbook.SheetNames.join(', ')}`);
        
        workbook.SheetNames.forEach(sheetName => {
            console.log(`\n-- Sheet: ${sheetName} --`);
            const sheet = workbook.Sheets[sheetName];
            const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            // Print top 10 rows
            const rows = json.slice(0, 10);
            rows.forEach((row, idx) => {
                const cleanedRow = row.map(cell => cell !== undefined ? cell : '').join(' | ');
                console.log(`Row ${idx + 1}: ${cleanedRow}`);
            });
        });
    } catch (e) {
        console.error(`Erro ao ler ${file}:`, e.message);
    }
});
