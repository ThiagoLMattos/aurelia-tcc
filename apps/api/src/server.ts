import express from 'express';
import cors from 'cors';
import diaryRoutes from './interfaces/routes/diaryRoute';
import sosRoutes from './interfaces/routes/sosRoutes';
import communicationRoutes from './interfaces/routes/communicationRoutes';
import taskRoutes from './interfaces/routes/taskRoutes';
import medicationRoutes from './interfaces/routes/medicationRoutes';


const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
   res.status(200).json({ status: 'ok', message: 'Aurelia API está rodando' });
});

app.use('/api', taskRoutes);
app.use('/api', diaryRoutes);
app.use('/api', sosRoutes);
app.use('/api', communicationRoutes);
app.use('/api', medicationRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
   console.log(`Servidor da Aurélia rodando na porta ${PORT}`);
    
});