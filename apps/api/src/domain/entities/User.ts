export interface User {
    uid: string;
    name: string;
    cpf: string;
    email: string;
    telephone?: string;
    role: 'patient' | 'caregiver' | 'admin';
    registeredAt: Date;
    acessedAt: Date;

    configuracoes: {
        theme: 'Claro' | 'Escuro';
        fontSize: 'Pequena' | 'Média' | 'Grande' | 'Extra Grande';
        constrast: 'Padrão' | 'Alto Contraste' | 'Monocromático';
        pushNotifications: boolean;
        additionalSettings?: string;
    };

    // Preenchido APENAS se role === 'patient' (Fusão da tabela Pacientes)
    pacienteProfile?: {
        diagnostico: string;
        dataDiagnostico: Date;
        nivel: 'Leve' | 'Moderado' | 'Grave';
        observacao?: string;
        cuidadoresVinculados: string[];
    };

// Preenchido APENAS se role === 'caregiver' (Fusão da tabela Cuidadores)
    cuidadorProfile?: {
        profissao: string;
        isPremium: boolean;
        pacieentesVinculados: string[];
    }
}