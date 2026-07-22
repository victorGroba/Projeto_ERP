import express from 'express';
import importacaoRoutes from '../src/routes/importacaoRoutes';
import syncRoutes from '../src/routes/syncRoutes';

const app = express();
app.use('/api/etl', importacaoRoutes);
app.use('/api/etl', syncRoutes);

app.listen(3002, () => {
    console.log('Server testing routing on 3002...');
    
    // Simulate GET /api/etl/historico
    fetch('http://localhost:3002/api/etl/historico')
        .then(res => res.status)
        .then(status => {
            console.log('Status code for /api/etl/historico:', status);
            process.exit(0);
        })
        .catch(console.error);
});
