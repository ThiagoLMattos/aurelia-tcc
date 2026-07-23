// @ts-nocheck

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';

// Importacao dos seus tokens e do componente de botao
import { PatientColors, Shadow } from '@/constants/theme';
import BotaoHome from '@/components/components_idoso/BotaoHome';

// Dados simulados para a interface
const DADOS_PACIENTE = {
  nome: 'Maria Aparecida',
  data: '22/07/2026',
  tarefas: [
    { id: '1', nome: '1 - Omeprazol', horario: '14:00' },
    { id: '2', nome: 'X - Tarefa', horario: '00:00' },
    { id: '3', nome: 'X - Tarefa', horario: '00:00' },
    { id: '4', nome: 'X - Tarefa', horario: '00:00' },
    { id: '5', nome: 'X - Tarefa', horario: '00:00' },
  ]
};

export default function TelaHomePaciente() {
  const router = useRouter();

  return (
    <View style={estilos.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Cabecalho verde com nome e data */}
      <View style={estilos.cabecalho}>
        <Text style={estilos.textoOla}>
          OLÁ ({DADOS_PACIENTE.nome.toUpperCase()})
        </Text>
        <Text style={estilos.textoData}>{DADOS_PACIENTE.data}</Text>
      </View>

      <ScrollView contentContainerStyle={estilos.rolagem} showsVerticalScrollIndicator={false}>
        
        {/* Cartao de resumo das tarefas (fundo creme) */}
        <View style={estilos.cartaoResumo}>
          {DADOS_PACIENTE.tarefas.map((tarefa) => (
            <View key={tarefa.id} style={estilos.linhaTarefa}>
              <Text style={estilos.nomeTarefa}>{tarefa.nome}</Text>
              
              {/* Pontilhado dinamico tipo sumario */}
              <Text style={estilos.pontos} numberOfLines={1} ellipsizeMode="clip">
                ....................................................................................................
              </Text>
              
              <Text style={estilos.horarioTarefa}>{tarefa.horario}</Text>
            </View>
          ))}
        </View>

        {/* Grade com os 4 botoes coloridos usando o componente BotaoHome */}
        <View style={estilos.gradeBotoes}>
          
          {/* Botao SOS */}
          <BotaoHome 
            corDeFundo={PatientColors.sosMain} 
            aoPressionar={() => router.push('/sos' as any)}
            estiloAdicional={estilos.ajusteBotaoGrade}
          >
            <Image 
              source={require('@/assets/images/Emergencia_icon.png')} 
            />
            <Text style={estilos.textoBotaoEmergencia}>SOS</Text>
          </BotaoHome>

          {/* Botao Tarefas */}
          <BotaoHome 
            corDeFundo={PatientColors.tasksMain} 
            aoPressionar={() => router.push('/tarefas' as any)}
            estiloAdicional={estilos.ajusteBotaoGrade}
          >
            <Image 
              source={require('@/assets/images/Tarefas_icon.png')} 
            />
            <Text style={estilos.textoBotaoTarefas}>TAREFAS</Text>
          </BotaoHome>

          {/* Botao Jogos */}
          <BotaoHome 
            corDeFundo={PatientColors.gamesMain} 
            aoPressionar={() => router.push('/jogos' as any)}
            estiloAdicional={estilos.ajusteBotaoGrade}
          >
            <Image 
              source={require('@/assets/images/Jogos_icon.png')} 
            />
            <Text style={estilos.textoBotaoJogos}>JOGOS</Text>
          </BotaoHome>

          {/* Botao Telefone */}
          <BotaoHome 
            corDeFundo={PatientColors.phoneMain} 
            aoPressionar={() => router.push('/telefone' as any)}
            estiloAdicional={estilos.ajusteBotaoGrade}
          >
            <Image 
              source={require('@/assets/images/Telefone_icon.png')} 
            />
            <Text style={estilos.textoBotaoTelefone}>TELEFONE</Text>
          </BotaoHome>

        </View>

        {/* Botao da Aurelia na parte de baixo */}
        <BotaoHome 
          corDeFundo={PatientColors.aureliaMain} 
          aoPressionar={() => router.push('/aurelia' as any)}
          estiloAdicional={estilos.ajusteBotaoAurelia}
        >
          <View style={estilos.circuloAvatar}>
            <Image 
              source={require('@/assets/images/LogoAvatar.png')} 
            />
          </View>
          <Text style={estilos.textoBotaoAurelia}>CONVERSAR COM AURÉLIA</Text>
        </BotaoHome>

      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  cabecalho: {
    backgroundColor: PatientColors.homeHeader,
    paddingTop: 30,
    paddingBottom: 10,
    paddingHorizontal: 25,
    ...Shadow.soft,
  },
  textoOla: {
    color: PatientColors.homeHeaderText,
    fontSize: 28,
    fontWeight: 'medium',
    right: 15,
    bottom: 15,
  },
  textoData: {
    color: PatientColors.homeHeaderSubtitle,
    fontSize: 24,
    textAlign: 'right',
    marginTop: 5,
  },
  rolagem: {
    padding: 20,
    gap: 25,
  },
  cartaoResumo: {
    backgroundColor: '#FAEEDA',
    borderColor: '#412402',
    borderWidth: 1,
    borderRadius: 10,
    paddingTop: 15,
    paddingHorizontal: 25,
    paddingBottom: 45,
    ...Shadow.medium,
  },
  linhaTarefa: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginVertical: 1,
  },
  nomeTarefa: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  pontos: {
    flex: 1,
    color: '#A09580',
    fontSize: 18,
    letterSpacing: 2,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  horarioTarefa: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  gradeBotoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 35,
  },
  ajusteBotaoGrade: {
    width: 150,
    height: 135,
    flexDirection: 'column',
    borderRadius: 10,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    ...Shadow.medium,
  },
  textoBotaoEmergencia: {
    color: PatientColors.sosHeaderText,
    fontSize: 32,
    fontWeight: 'bold',
  },
  textoBotaoTarefas: {
    color: PatientColors.tasksHeaderText,
    fontSize: 30,
    fontWeight: 'bold',
  },
  textoBotaoJogos: {
    color: PatientColors.gamesHeaderText,
    fontSize: 32,
    fontWeight: 'bold',
  },
  textoBotaoTelefone: {
    color: PatientColors.phoneHeaderText,
    fontSize: 27,
    fontWeight: 'bold',
  },
  ajusteBotaoAurelia: {
    width: '100%',
    paddingVertical: 20,
    gap: 20,
    borderRadius: 10,
    marginTop: 20,
    ...Shadow.medium,
  },
  circuloAvatar: {
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoBotaoAurelia: {
    color: PatientColors.aureliaHeaderText,
    fontSize: 20,
    fontWeight: 'bold',
  },
});