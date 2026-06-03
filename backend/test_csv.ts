import { ImportacaoService } from './src/services/importacaoService';
import fs from 'fs';

const mockCsv = `Categoria;Centro de Custo;jan./25;fev./25
Serviços em Geral;Marketing;1.500,00;1.200,50
Agua;Geral;150,00;160,00`;

fs.writeFileSync('test.csv', mockCsv, 'utf8');

async function test() {
    try {
        const result = await ImportacaoService.processarCSV('test.csv', 'DESPESAS');
        console.log('Success:', result);
    } catch (e) {
        console.error('Error during CSV process:', e);
    }
}

test();
