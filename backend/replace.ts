import fs from 'fs';

const filePath = './src/services/contaAzulSyncService.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const targetFunction = `    /**
     * Simulates fetching Service Invoices (Prioritizing Gross Value)
     */
    static async syncInvoices() {
        const accountRJ = await prisma.gestaoContas.findFirst({ where: { nomeFilial: 'Rio de Janeiro' } });
        const accountSP = await prisma.gestaoContas.findFirst({ where: { nomeFilial: 'São Paulo' } });

        if (!accountRJ || !accountSP) return;

        const count = await prisma.invoice.count();
        if (count > 0) return; // Prevent duplicating mocks on every click

        const generateRandomInvoices = (clientId: string, accountId: string, startYear: number) => {
            const invoices = [];
            for (let m = 1; m <= 12; m++) {
                invoices.push({
                    invoiceNumber: \`NFS-\${clientId}-\${startYear}-\${m}\`,
                    issueDate: new Date(\`\${startYear}-\${m.toString().padStart(2, '0')}-15\`),
                    grossValue: Math.floor(Math.random() * 50000) + 10000, // Regra Valor Bruto (Módulo 1)
                    clientId: clientId,
                    accountId: accountRJ.id
                });
            }
            return invoices;
        };

        const allInvoices = [
            ...generateRandomInvoices('ca_cli_1', accountSP.id, 2022),
            ...generateRandomInvoices('ca_cli_1', accountSP.id, 2023),
            ...generateRandomInvoices('ca_cli_2', accountRJ.id, 2023),
            ...generateRandomInvoices('ca_cli_3', accountRJ.id, 2023),
            ...generateRandomInvoices('ca_cli_4', accountSP.id, 2023),
            ...generateRandomInvoices('ca_cli_5', accountRJ.id, 2023),
        ];

        await prisma.invoice.createMany({ data: allInvoices });
        console.log(\`[ETL] \${allInvoices.length} Notas Fiscais importadas.\`);
    }`;

const newFunction = `    /**
     * Fetches real Service Invoices from Conta Azul or falls back to realistic mocks
     */
    static async syncInvoices() {
        const accountRJ = await prisma.gestaoContas.findFirst({ where: { nomeFilial: 'Rio de Janeiro' } });
        const accountSP = await prisma.gestaoContas.findFirst({ where: { nomeFilial: 'São Paulo' } });

        if (!accountRJ || !accountSP) return;

        const count = await prisma.invoice.count();
        if (count > 0) return;

        const api = new ContaAzulAPI(accountRJ.accessToken || '');
        const sales = accountRJ.accessToken ? await api.getSales('2023-01-01', '2024-12-31') : null;
        let allInvoices: any[] = [];

        if (sales && sales.length > 0) {
            allInvoices = sales.map((s: any) => ({
                invoiceNumber: s.number || \`NFS-API-\${Math.floor(Math.random() * 99999)}\`,
                issueDate: new Date(s.emission),
                grossValue: s.total,
                clientId: s.customer?.id || 'ca_cli_1',
                accountId: accountRJ.id
            }));
        } else {
            console.log('[ETL] Sandbox API retornou nulo. Gerando fallback...');
            const generateRandomInvoices = (clientId: string, accountId: string, startYear: number) => {
                const invoices = [];
                for (let m = 1; m <= 12; m++) {
                    invoices.push({
                        invoiceNumber: \`NFS-\${clientId}-\${startYear}-\${m}\`,
                        issueDate: new Date(\`\${startYear}-\${m.toString().padStart(2, '0')}-15\`),
                        grossValue: Math.floor(Math.random() * 50000) + 10000,
                        clientId: clientId,
                        accountId: accountRJ.id
                    });
                }
                return invoices;
            };

            allInvoices = [
                ...generateRandomInvoices('ca_cli_1', accountSP.id, 2022),
                ...generateRandomInvoices('ca_cli_1', accountSP.id, 2023),
                ...generateRandomInvoices('ca_cli_2', accountRJ.id, 2023),
                ...generateRandomInvoices('ca_cli_3', accountRJ.id, 2023),
                ...generateRandomInvoices('ca_cli_4', accountSP.id, 2023),
                ...generateRandomInvoices('ca_cli_5', accountRJ.id, 2023),
            ];
        }

        await prisma.invoice.createMany({ data: allInvoices });
        console.log(\`[ETL] \${allInvoices.length} Notas Fiscais cadastradas.\`);
    }`;

if (content.includes(targetFunction)) {
    content = content.replace(targetFunction, newFunction);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Successfully replaced via TS Script');
} else {
    console.error('Target string not found!');
}
