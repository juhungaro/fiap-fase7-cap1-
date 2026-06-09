import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Switch,
  Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export default function App() {
  // Autenticação e Configuração de API
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userRole, setUserRole] = useState(''); // 'medico' | 'paciente'
  const [apiBase, setApiBase] = useState('http://192.168.1.15:8000'); // IP do Computador na Rede Local
  const [authLoading, setAuthLoading] = useState(false);

  // Navegação Interna do App ('dashboard' | 'chat')
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'chat'>('dashboard');

  // Telemetria e IA
  const [telemetry, setTelemetry] = useState<any>(null);
  const [risk, setRisk] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [dashLoading, setDashLoading] = useState(false);

  // Triagem Avançada
  const [triagemResult, setTriagemResult] = useState<any>(null);
  const [triagemLoading, setTriagemLoading] = useState(false);

  // Chatbot
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Polling de telemetria
  useEffect(() => {
    let interval: any;
    if (isLoggedIn && autoRefresh) {
      fetchDashboard();
      interval = setInterval(fetchDashboard, 3000);
    }
    return () => clearInterval(interval);
  }, [isLoggedIn, autoRefresh, apiBase]);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${apiBase}/api/patients/dashboard`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTelemetry(data.last_telemetry);
      setRisk(data.risk_assessment);
      setProfile(data.profile);
      setHistory(data.telemetry_history || []);
    } catch (e) {
      console.log("Erro de conexão ao backend.");
    }
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert("Erro", "Por favor, insira seu usuário.");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUserRole(data.role);
      setIsLoggedIn(true);
      fetchDashboard();
    } catch (e) {
      Alert.alert("Erro de Conexão", `Não foi possível conectar ao backend em ${apiBase}. Verifique se o endereço IP está correto e o servidor FastAPI está rodando.`);
    } finally {
      setAuthLoading(false);
    }
  };

  const triggerTelemetrySimulation = async (customBpm?: number, customSpo2?: number) => {
    try {
      const bpm = customBpm || Math.floor(Math.random() * (125 - 65) + 65);
      const spo2 = customSpo2 || Math.floor(Math.random() * (100 - 88) + 88);
      const temp = parseFloat((Math.random() * (39.2 - 36.0) + 36.0).toFixed(1));

      await fetch(`${apiBase}/api/iot/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_id: "default_patient",
          freq_cardiaca: bpm,
          spo2: spo2,
          temperatura: temp
        })
      });
      fetchDashboard();
    } catch (e) {
      console.log("Erro de simulação.");
    }
  };

  const runTriagemAvançada = async () => {
    setTriagemLoading(true);
    setTriagemResult(null);
    try {
      const res = await fetch(`${apiBase}/api/patients/analyze`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTriagemResult(data);
    } catch (e) {
      Alert.alert("Erro", "Erro ao executar triagem multiagente. Chave de API OpenAI não definida?");
    } finally {
      setTriagemLoading(false);
    }
  };

  // Chatbot
  const ensureChatSession = async () => {
    if (sessionId) return sessionId;
    try {
      const res = await fetch(`${apiBase}/api/chat/session`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSessionId(data.session_id);
      setMessages([{ id: 'welcome', text: data.message, role: 'assistant' }]);
      return data.session_id;
    } catch (e) {
      return null;
    }
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setMessages(m => [...m, { id: Date.now().toString(), text, role: 'user' }]);
    setChatLoading(true);

    try {
      const sid = await ensureChatSession();
      if (!sid) throw new Error();
      const res = await fetch(`${apiBase}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, text })
      });
      const data = await res.json();
      data.output.forEach((line: string, i: number) => {
        if (line) {
          setMessages(m => [...m, { id: `${Date.now()}-${i}`, text: line, role: 'assistant' }]);
        }
      });
    } catch (e) {
      setMessages(m => [...m, { id: `err-${Date.now()}`, text: "CardioIA offline. Tente novamente.", role: 'assistant' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const getRiskColor = (riskClass: string) => {
    switch (riskClass) {
      case 'baixo': return '#22c55e';
      case 'moderado': return '#eab308';
      case 'alto': return '#f97316';
      case 'critico': return '#ef4444';
      default: return '#3b82f6';
    }
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.loginContainer}>
          <View style={styles.loginCard}>
            <View style={styles.logoCircle}>
              <Ionicons name="heart" size={40} color="#ef4444" />
            </View>
            <Text style={styles.title}>CardioIA</Text>
            <Text style={styles.subtitle}>Plataforma de Inteligência Cardíaca</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Endereço da API Backend</Text>
              <TextInput
                style={styles.input}
                value={apiBase}
                onChangeText={setApiBase}
                placeholder="ex: http://192.168.1.15:8000"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Identificação CRM ou CPF</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Nome, CRM ou CPF"
                placeholderTextColor="#64748b"
              />
            </View>

            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={authLoading}>
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Entrar</Text>}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity 
              style={[styles.quickBtn, {backgroundColor: 'rgba(37,99,235,0.15)', borderColor: '#2563eb'}]} 
              onPress={() => { setUsername('Dr. Leonardo (Médico)'); setApiBase(apiBase); setIsLoggedIn(true); setUserRole('medico'); }}
            >
              <Text style={[styles.quickBtnText, {color: '#60a5fa'}]}>Acesso Rápido: Médico</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.quickBtn, {backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)'}]} 
              onPress={() => { setUsername('Juliana (Paciente)'); setApiBase(apiBase); setIsLoggedIn(true); setUserRole('paciente'); }}
            >
              <Text style={[styles.quickBtnText, {color: '#cbd5e1'}]}>Acesso Rápido: Paciente</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="heart" size={20} color="#ef4444" />
          <Text style={styles.headerTitle}>CardioIA</Text>
        </View>
        <Text style={styles.headerUser}>{username}</Text>
      </View>

      {/* Navegação por Abas */}
      <View style={styles.tabRow}>
        <TouchableOpacity 
          style={[styles.tabBtn, currentTab === 'dashboard' && styles.tabBtnActive]} 
          onPress={() => setCurrentTab('dashboard')}
        >
          <Ionicons name="apps" size={18} color={currentTab === 'dashboard' ? '#fff' : '#94a3b8'} />
          <Text style={[styles.tabBtnText, currentTab === 'dashboard' && styles.tabBtnTextActive]}>Monitoramento</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, currentTab === 'chat' && styles.tabBtnActive]} 
          onPress={() => { setCurrentTab('chat'); ensureChatSession(); }}
        >
          <Ionicons name="chatbubbles" size={18} color={currentTab === 'chat' ? '#fff' : '#94a3b8'} />
          <Text style={[styles.tabBtnText, currentTab === 'chat' && styles.tabBtnTextActive]}>Chat CardioIA</Text>
        </TouchableOpacity>
      </View>

      {/* Conteúdo */}
      {currentTab === 'dashboard' ? (
        <ScrollView style={styles.contentScroll} contentContainerStyle={{paddingBottom: 40}}>
          {/* Card Paciente */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Paciente Monitorado</Text>
            <View style={styles.patientRow}>
              <View style={styles.patientItem}><Text style={styles.patientLabel}>Nome</Text><Text style={styles.patientValue}>{profile?.nome || 'João'}</Text></View>
              <View style={styles.patientItem}><Text style={styles.patientLabel}>Idade</Text><Text style={styles.patientValue}>{profile?.idade || 72} anos</Text></View>
            </View>
          </View>

          {/* Sinais Vitais IoT */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Leituras IoT (Tempo Real)</Text>
              <Switch value={autoRefresh} onValueChange={setAutoRefresh} thumbColor="#2563eb" trackColor={{false: '#475569', true: '#1e3a8a'}} />
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricWidget}>
                <Ionicons name="heart-pulse" size={24} color="#ef4444" />
                <Text style={styles.metricValue}>{telemetry?.freq_cardiaca || '--'}</Text>
                <Text style={styles.metricLabel}>BPM</Text>
              </View>
              <View style={styles.metricWidget}>
                <Ionicons name="water" size={24} color="#3b82f6" />
                <Text style={styles.metricValue}>{telemetry?.spo2 || '--'}</Text>
                <Text style={styles.metricLabel}>SpO2 (%)</Text>
              </View>
              <View style={styles.metricWidget}>
                <Ionicons name="thermometer" size={24} color="#f97316" />
                <Text style={styles.metricValue}>{telemetry?.temperatura || '--'}</Text>
                <Text style={styles.metricLabel}>Temp (°C)</Text>
              </View>
            </View>

            {/* Simuladores IoT de Hardware */}
            <Text style={styles.simTitle}>Simular Entrada de Hardware</Text>
            <View style={styles.simBtnRow}>
              <TouchableOpacity style={styles.simBtnNormal} onPress={() => triggerTelemetrySimulation(75, 98)}>
                <Text style={styles.simBtnText}>Normal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.simBtnCritico} onPress={() => triggerTelemetrySimulation(120, 86)}>
                <Text style={styles.simBtnText}>Risco</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Risco Predict IA */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Avaliação Preditiva de Risco</Text>
            <View style={[styles.riskBadge, {backgroundColor: getRiskColor(risk?.classificacao_risco || 'baixo')}]}>
              <Text style={styles.riskBadgeText}>
                RISCO {(risk?.classificacao_risco || 'baixo').toUpperCase()} ({(risk?.probabilidade_pico_risco * 100 || 0).toFixed(1)}%)
              </Text>
            </View>

            <Text style={[styles.simTitle, {marginTop: 15}]}>Condutas Médicas Sugeridas:</Text>
            {risk?.protocolos_sugeridos?.map((p: string, idx: number) => (
              <View key={idx} style={styles.protocolRow}>
                <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
                <Text style={styles.protocolText}>{p}</Text>
              </View>
            ))}

            {userRole === 'medico' && (
              <TouchableOpacity style={styles.triagemBtn} onPress={runTriagemAvançada} disabled={triagemLoading}>
                {triagemLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.triagemBtnText}>Triagem Multiagente (Fase 6)</Text>}
              </TouchableOpacity>
            )}
          </View>

          {/* Relatório de Agentes */}
          {triagemResult && (
            <View style={[styles.card, {borderColor: '#22c55e', borderWidth: 1}]}>
              <Text style={styles.cardTitle}>Decisão Estruturada da IA</Text>
              <Text style={styles.triagemNotas}>{triagemResult.notas}</Text>
              <Text style={styles.triagemFooter}>Auditoria: {triagemResult.classificacao_risco.toUpperCase()}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.logoutBtnBig} onPress={() => setIsLoggedIn(false)}>
            <Text style={styles.logoutBtnBigText}>Desconectar</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView 
          style={styles.chatContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({item}) => (
              <View style={[styles.msgWrap, item.role === 'user' ? styles.msgWrapUser : styles.msgWrapOther]}>
                <View style={[styles.msgBubble, item.role === 'user' ? styles.msgUser : styles.msgAssistant]}>
                  <Text style={styles.msgText}>{item.text}</Text>
                </View>
              </View>
            )}
            contentContainerStyle={styles.chatList}
          />
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Descreva sintomas..."
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity style={styles.chatSendBtn} onPress={sendChatMessage} disabled={chatLoading}>
              {chatLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loginContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loginCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  logoCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 24,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
  },
  loginBtn: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    width: '100%',
    marginVertical: 20,
  },
  quickBtn: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  quickBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  headerUser: {
    color: '#94a3b8',
    fontSize: 13,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    padding: 6,
    borderRadius: 10,
    margin: 16,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#2563eb',
  },
  tabBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#fff',
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  patientRow: {
    flexDirection: 'row',
    gap: 16,
  },
  patientItem: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    padding: 10,
    borderRadius: 8,
  },
  patientLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  patientValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricWidget: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  simTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  simBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  simBtnNormal: {
    flex: 1,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  simBtnCritico: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  simBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  riskBadge: {
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  riskBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  protocolRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
    paddingRight: 10,
  },
  protocolText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  triagemBtn: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  triagemBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  triagemNotas: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  triagemFooter: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  logoutBtnBig: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
  },
  logoutBtnBigText: {
    color: '#f87171',
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
  },
  chatList: {
    padding: 16,
  },
  msgWrap: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  msgWrapUser: {
    justifyContent: 'flex-end',
  },
  msgWrapOther: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 14,
  },
  msgUser: {
    backgroundColor: '#2563eb',
  },
  msgAssistant: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  msgText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
  chatInputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#fff',
  },
  chatSendBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
