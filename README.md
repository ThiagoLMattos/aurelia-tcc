<div align="center">

  # Aurélia

  **Sistema assistivo para idosos com Alzheimer em estágio inicial e seus cuidadores**

  🔗 [Landing page publicada](https://aureliatcc1.github.io/)
</div>

---

## Sobre o projeto

O **Aurélia** é um sistema integrado que conecta, em tempo real, idosos em estágio inicial de
Alzheimer e seus cuidadores. Ele é formado por um aplicativo mobile com duas interfaces
(uma simplificada para o idoso e um painel de acompanhamento para o cuidador) e um módulo de
hardware com GPS para geofencing.

Trabalho de Conclusão de Curso (TCC) desenvolvido na ETEC Bento Quirino.

---

## Estrutura do monorepo

| Pasta | Conteúdo |
| --- | --- |
| `apps/mobile` | App Expo (SDK 54) com as áreas do cuidador e do idoso |
| `apps/api` | API Node.js (Express + Firebase Admin) |
| `packages/shared` | Contrato compartilhado (schemas zod, tipos e helpers) |
| `firebase/` | Regras do Firestore e configuração dos emuladores |

## Como rodar o projeto

### Pré-requisitos

- [Node.js](https://nodejs.org/) 22 ou superior
- Expo Go no celular ou emulador configurado

### Passo a passo

```bash
git clone https://github.com/ThiagoLMattos/aurelia-tcc.git
cd aurelia-tcc
npm install          # uma única vez, na raiz
npm run dev:mobile   # app (Expo)
npm run dev:api      # API
npm run emulators    # emuladores do Firebase (Auth + Firestore)
```

Copie `.env.example` para `.env` e preencha os valores para rodar a API e o app.

Outros comandos na raiz: `npm run typecheck`, `npm run lint`, `npm test` (pacote shared) e `npm run test:api` (API, sobe os emuladores; precisa de Java 11+). Detalhes em `apps/api/README.md` e `apps/mobile/README.md` (modo demonstração sem backend, rodar no celular, push).

---

## Problema

Pessoas em estágio inicial de Alzheimer esquecem tarefas simples do dia a dia, como tomar
remédios ou lembrar em que dia da semana estão, e podem sair de casa sem avisar ninguém.
Seus cuidadores, por sua vez, vivem em estado constante de alerta, sem visibilidade real
sobre a rotina e a localização de quem cuidam, o que gera desgaste físico e emocional para
os dois lados.

## Solução

O Aurélia une as duas pontas dessa rotina em um único sistema:

- **App do idoso**: interface simplificada, com lembretes de medicação e rotina guiados por
  uma assistente de IA que conversa por voz.
- **Painel do cuidador**: histórico de atividades, alertas em tempo real e gestão de contatos
  de emergência.
- **Módulo de geolocalização**: hardware com ESP32 e GPS que cria uma "zona segura" ao redor
  de casa e dispara um alerta imediato ao cuidador caso ela seja rompida.

## Público-alvo

- Idosos em estágio inicial de Alzheimer, que ainda têm autonomia mas precisam de apoio leve
  no dia a dia.
- Cuidadores e familiares responsáveis por essa rotina de cuidado.

## Tecnologias utilizadas

| Camada | Tecnologias |
| --- | --- |
| App mobile | React Native (Expo) |
| Backend | Node.js, Firebase |
| Inteligência artificial | Groq API |
| Hardware / geofencing | ESP32, GPS NEO-6M |
| Landing page | HTML5, CSS3, JavaScript |

## Equipe

| Nome | Responsabilidade |
| --- | --- |
| Pedro Isaías | Desenvolvedor do Aurélia |
| Pyetro Fabrício | Desenvolvedor do Aurélia |
| Thiago Mattos | Desenvolvedor do Aurélia |
| Simone Lacerda | Orientadora |
| Tiago Jesus | Coorientador |

## Landing page

A landing page está publicada via GitHub Pages em:
**[https://aureliatcc1.github.io/](https://aureliatcc1.github.io/)**