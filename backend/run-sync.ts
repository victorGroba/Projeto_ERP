import * as dotenv from 'dotenv';
import { ContaAzulSyncService } from './src/services/contaAzulSyncService';

dotenv.config();

async function main() {
    console.log('🚀 Iniciando script de teste de ETL manual para 2025/2026...');
    try {
        const result = await ContaAzulSyncService.runFullSync();
        console.log('✅ Resultado:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('❌ Erro Fatal:', e);
    }
    process.exit(0);
}

main();
