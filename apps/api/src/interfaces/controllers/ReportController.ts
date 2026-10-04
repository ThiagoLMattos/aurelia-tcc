import { Request, Response } from 'express';
import { GeneratePatientReport } from '../../domain/use-cases/GeneratePatientReport';

export class ReportController {
    constructor(private generatePatientReport: GeneratePatientReport) {}

    async getReport(req: Request, res: Response): Promise<Response> {
        try {
            const patientIdParam = req.params.patientId;
            const patientId = Array.isArray(patientIdParam) ? patientIdParam[0] : patientIdParam;
            const dias = req.query.dias ? parseInt(req.query.dias as string) : 7;

            if (!patientId) {
                return res.status(400).json({ error: 'patientId is required' });
            }

            const report = await this.generatePatientReport.execute(patientId, dias);
            
            return res.status(200).json(report);
        }

        catch (error: any) {
            return res.status(500).json({
                error: error.message
            });
        }
    }
}