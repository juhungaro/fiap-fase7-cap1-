import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, Thermometer, Activity, Brain, ShieldAlert, 
  Send, User, Lock, LogOut, Settings, RefreshCw, 
  AlertTriangle, CheckCircle, ChevronRight, MessageSquare, X, Users, ClipboardList
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  // Autenticação
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userRole, setUserRole] = useState(''); // 'medico' ou 'paciente'
  const [token, setToken] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard de Dados Cardíacos
  const [dashboardData, setDashboardData] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Triagem Avançada (Multiagente)
  const [triagemResult, setTriagemResult] = useState(null);
  const [triagemLoading, setTriagemLoading] = useState(false);

  // Configurações do Paciente (Simulação)
  const [editAge, setEditAge] = useState(72);
  const [editName, setEditName] = useState('João da Silva');
  const [editCarga, setEditCarga] = useState(60);
  const [editRecursos, setEditRecursos] = useState(40);
  const [showConfig, setShowConfig] = useState(false);

  // Chatbot
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Auto-rolagem do chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Carregar dados do Dashboard periodicamente
  useEffect(() => {
    let interval;
    if (isLoggedIn && autoRefresh) {
      fetchDashboard();
      interval = setInterval(fetchDashboard, 3000); // Polling a cada 3 segundos para tempo real
    }
    return () => clearInterval(interval);
  }, [isLoggedIn, autoRefresh]);

  // Buscar dados do dashboard no backend
  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/patients/dashboard`);
      if (!res.ok) throw new Error('Erro ao carregar dados do painel');
      const data = await res.json();
      setDashboardData(data);
      setDashError('');
    } catch (err) {
      console.error(err);
      setDashError('Falha na conexão com o servidor CardioIA.');
    } finally {
      setDashLoading(false);
    }
  };

  // Simular envio de telemetria manual pelo Frontend
  const triggerTelemetrySimulation = async (customBpm, customSpo2, customTemp) => {
    try {
      const res = await fetch(`${API_BASE}/api/iot/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente_id: "default_patient",
          freq_cardiaca: customBpm || Math.floor(Math.random() * (130 - 65) + 65),
          spo2: customSpo2 || Math.floor(Math.random() * (100 - 85) + 85),
          temperatura: customTemp || parseFloat((Math.random() * (39.5 - 35.8) + 35.8).toFixed(1))
        })
      });
      if (res.ok) {
        fetchDashboard();
      }
    } catch (err) {
      console.error("Erro ao simular telemetria:", err);
    }
  };

  // Salvar configurações do paciente (Simulador)
  const savePatientSetup = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/patients/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: editName,
          idade: parseFloat(editAge),
          carga_sistema: parseFloat(editCarga),
          disponibilidade_recursos: parseFloat(editRecursos)
        })
      });
      if (res.ok) {
        setShowConfig(false);
        fetchDashboard();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Executar Triagem Avançada (Orquestração Multiagente da Fase 6)
  const runTriagemAvançada = async () => {
    setTriagemLoading(true);
    setTriagemResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/patients/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Falha ao processar triagem multiagente');
      const data = await res.json();
      setTriagemResult(data);
    } catch (err) {
      console.error(err);
      alert('Erro na triagem multiagente: certifique-se de que a OpenAI API Key está ativa ou o backend configurado.');
    } finally {
      setTriagemLoading(false);
    }
  };

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error('Dados de autenticação inválidos');
      const data = await res.json();
      setToken(data.token);
      setUserRole(data.role);
      setIsLoggedIn(true);
      
      // Carregar valores de simulação com base no perfil do backend
      fetchDashboard();
    } catch (err) {
      setAuthError(err.message || 'Falha ao conectar.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    setIsLoggedIn(false);
    setToken('');
    setUserRole('');
    setDashboardData(null);
    setTriagemResult(null);
  };

  // Chatbot: Inicializar Sessão
  const ensureChatSession = async () => {
    if (chatSessionId) return chatSessionId;
    try {
      const res = await fetch(`${API_BASE}/api/chat/session`, { method: 'POST' });
      if (!res.ok) throw new Error('Falha ao criar sessão de chat');
      const data = await res.json();
      setChatSessionId(data.session_id);
      setChatMessages([{ id: 'welcome', text: data.message, role: 'assistant' }]);
      return data.session_id;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  // Chatbot: Enviar Mensagem
  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    
    // Adiciona mensagem do usuário
    const userMsgId = Date.now().toString();
    setChatMessages(prev => [...prev, { id: userMsgId, text, role: 'user' }]);
    setChatLoading(true);

    try {
      const sid = await ensureChatSession();
      if (!sid) throw new Error('Sem sessão ativa');

      const res = await fetch(`${API_BASE}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, text })
      });
      if (!res.ok) throw new Error('Erro na resposta do chatbot');
      const data = await res.json();
      
      // Adiciona mensagens do assistente
      data.output.forEach((line, index) => {
        if (line) {
          setChatMessages(prev => [...prev, { id: `${Date.now()}-${index}`, text: line, role: 'assistant' }]);
        }
      });
    } catch (err) {
      setChatMessages(prev => [...prev, { id: `err-${Date.now()}`, text: 'CardioIA offline. Resposta local: Fale um pouco mais sobre seus sintomas, por exemplo, se sente dor no peito ou falta de ar.', role: 'assistant' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Renderizar a tela de Login
  if (!isLoggedIn) {
    return (
      <div style={loginStyles.container}>
        <div style={loginStyles.card} className="glass-panel animate-slide-up">
          <div style={loginStyles.header}>
            <div style={loginStyles.iconContainer}>
              <Heart size={36} color="#ef4444" className="pulse-heart" />
            </div>
            <h1 style={loginStyles.title}>CardioIA</h1>
            <p style={loginStyles.subtitle}>Plataforma de Inteligência Cardíaca Total</p>
          </div>
          
          <form onSubmit={handleLogin} style={loginStyles.form}>
            <div style={loginStyles.inputGroup}>
              <label style={loginStyles.label}>Identificação (CRM ou CPF)</label>
              <div style={loginStyles.inputWrapper}>
                <User size={18} color="#94a3b8" style={loginStyles.inputIcon} />
                <input
                  type="text"
                  placeholder="CRM Médico ou CPF do Paciente"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={loginStyles.input}
                  required
                />
              </div>
            </div>

            <div style={loginStyles.inputGroup}>
              <label style={loginStyles.label}>Senha de Segurança</label>
              <div style={loginStyles.inputWrapper}>
                <Lock size={18} color="#94a3b8" style={loginStyles.inputIcon} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={loginStyles.input}
                />
              </div>
            </div>

            {authError && <div style={loginStyles.error} className="animate-fade-in">{authError}</div>}

            <button type="submit" disabled={authLoading} style={loginStyles.button}>
              {authLoading ? 'Autenticando...' : 'Acessar Plataforma'}
            </button>
          </form>

          <div style={loginStyles.divider}>
            <span style={loginStyles.dividerText}>Acesso Rápido para Avaliação</span>
          </div>

          <div style={loginStyles.quickButtons}>
            <button 
              onClick={() => { setUsername('Dr. Leonardo Orabona (Médico)'); setIsLoggedIn(true); setUserRole('medico'); }}
              style={loginStyles.quickButtonPrimary}
            >
              <Users size={16} style={{marginRight: '6px'}} /> Perfil Médico (CRM)
            </button>
            <button 
              onClick={() => { setUsername('Juliana Fidelis (Paciente)'); setIsLoggedIn(true); setUserRole('paciente'); }}
              style={loginStyles.quickButtonSecondary}
            >
              <User size={16} style={{marginRight: '6px'}} /> Perfil Paciente (CPF)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Obter cores com base na severidade do risco
  const getRiskColor = (riskClass) => {
    switch (riskClass) {
      case 'baixo': return '#22c55e';
      case 'moderado': return '#eab308';
      case 'alto': return '#f97316';
      case 'critico': return '#ef4444';
      default: return '#3b82f6';
    }
  };

  // Se logado, renderizar Dashboard Principal
  const tele = dashboardData?.last_telemetry || {};
  const assessment = dashboardData?.risk_assessment || {};
  const profile = dashboardData?.profile || {};
  const history = dashboardData?.telemetry_history || [];

  // Calcular pontos para o gráfico de linha SVG
  const renderSvgChart = () => {
    if (history.length < 2) return null;
    const width = 500;
    const height = 120;
    const padding = 15;
    
    const minVal = Math.min(...history.map(h => h.freq_cardiaca)) - 5;
    const maxVal = Math.max(...history.map(h => h.freq_cardiaca)) + 5;
    const range = maxVal - minVal || 1;

    const points = history.map((h, i) => {
      const x = padding + (i * (width - 2 * padding)) / (history.length - 1);
      const y = height - padding - ((h.freq_cardiaca - minVal) * (height - 2 * padding)) / range;
      return { x, y };
    });

    const pathData = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    const areaPath = `${pathData} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={dashStyles.svg}>
        <defs>
          <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Linha de Grade */}
        <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
        
        {/* Área preenchida com degradê */}
        <path d={areaPath} fill="url(#chartGlow)" />
        
        {/* Linha principal do gráfico */}
        <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
        
        {/* Pontos nas medições */}
        {points.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r={idx === points.length - 1 ? 5 : 2.5} fill={idx === points.length - 1 ? "#ef4444" : "#3b82f6"} />
        ))}
      </svg>
    );
  };

  return (
    <div style={dashStyles.container} className="animate-fade-in">
      {/* Header do Dashboard */}
      <header style={dashStyles.header} className="glass-panel">
        <div style={dashStyles.logoGroup}>
          <div style={dashStyles.logoIcon}>
            <Heart size={24} color="#ef4444" className="pulse-heart" />
          </div>
          <div>
            <h1 style={dashStyles.logoText}>CardioIA</h1>
            <p style={dashStyles.logoSubText}>Total Health Care Panel</p>
          </div>
        </div>

        <div style={dashStyles.userInfoGroup}>
          <div style={dashStyles.roleBadge}>
            <ShieldAlert size={14} style={{marginRight: '5px'}} />
            <span>{userRole === 'medico' ? 'Ambiente Clínico' : 'Paciente Conectado'}</span>
          </div>
          <div style={dashStyles.userProfile}>
            <User size={16} />
            <span style={{fontWeight: '500'}}>{username}</span>
          </div>
          <button onClick={handleLogout} style={dashStyles.logoutBtn}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Grid Principal do Dashboard */}
      <main style={dashStyles.mainGrid}>
        
        {/* Coluna da Esquerda: Dados do Paciente e Leituras IoT */}
        <div style={dashStyles.leftColumn}>
          
          {/* Card de Informações e Status Geral do Paciente */}
          <div style={dashStyles.card} className="glass-panel">
            <div style={dashStyles.cardHeader}>
              <h2 style={dashStyles.cardTitle}>Paciente Monitorado</h2>
              <button onClick={() => setShowConfig(!showConfig)} style={dashStyles.iconBtn}>
                <Settings size={18} color="#94a3b8" />
              </button>
            </div>

            {showConfig ? (
              <form onSubmit={savePatientSetup} style={dashStyles.setupForm} className="animate-slide-up">
                <div style={dashStyles.formGroup}>
                  <label style={dashStyles.formLabel}>Nome do Paciente</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={dashStyles.formInput} />
                </div>
                <div style={dashStyles.formRow}>
                  <div style={dashStyles.formGroupHalf}>
                    <label style={dashStyles.formLabel}>Idade</label>
                    <input type="number" value={editAge} onChange={e => setEditAge(e.target.value)} style={dashStyles.formInput} />
                  </div>
                  <div style={dashStyles.formGroupHalf}>
                    <label style={dashStyles.formLabel}>Carga Hospital (%)</label>
                    <input type="number" value={editCarga} onChange={e => setEditCarga(e.target.value)} style={dashStyles.formInput} />
                  </div>
                </div>
                <div style={dashStyles.formGroup}>
                  <label style={dashStyles.formLabel}>Recursos de Emergência (%)</label>
                  <input type="number" value={editRecursos} onChange={e => setEditRecursos(e.target.value)} style={dashStyles.formInput} />
                </div>
                <div style={dashStyles.formActions}>
                  <button type="submit" style={dashStyles.btnSave}>Salvar Configuração</button>
                  <button type="button" onClick={() => setShowConfig(false)} style={dashStyles.btnCancel}>Cancelar</button>
                </div>
              </form>
            ) : (
              <div style={dashStyles.patientDetails}>
                <div style={dashStyles.detailItem}>
                  <span style={dashStyles.detailLabel}>Nome:</span>
                  <span style={dashStyles.detailValue}>{profile.nome || 'Carregando...'}</span>
                </div>
                <div style={dashStyles.detailItem}>
                  <span style={dashStyles.detailLabel}>Idade:</span>
                  <span style={dashStyles.detailValue}>{profile.idade} anos</span>
                </div>
                <div style={dashStyles.detailItem}>
                  <span style={dashStyles.detailLabel}>Carga do Sistema:</span>
                  <span style={dashStyles.detailValue}>{profile.carga_sistema}%</span>
                </div>
                <div style={dashStyles.detailItem}>
                  <span style={dashStyles.detailLabel}>Disponibilidade de Recursos:</span>
                  <span style={dashStyles.detailValue}>{profile.disponibilidade_recursos}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Card de Sensores IoT em Tempo Real */}
          <div style={dashStyles.card} className="glass-panel">
            <div style={dashStyles.cardHeader}>
              <h2 style={dashStyles.cardTitle}>Sinais Vitais (Telemetria IoT ESP32)</h2>
              <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                <span style={{
                  fontSize: '11px', 
                  color: autoRefresh ? '#22c55e' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <RefreshCw size={12} className={autoRefresh ? "pulse-heart" : ""} />
                  {autoRefresh ? 'Em tempo real' : 'Pausado'}
                </span>
                <input 
                  type="checkbox" 
                  checked={autoRefresh} 
                  onChange={(e) => setAutoRefresh(e.target.checked)} 
                  style={{cursor: 'pointer'}} 
                />
              </div>
            </div>

            {dashError ? (
              <div style={dashStyles.dashErrorBox}>
                <AlertTriangle size={20} color="#ef4444" style={{marginRight: '8px'}} />
                <span>{dashError}</span>
              </div>
            ) : (
              <div style={dashStyles.widgetsGrid}>
                {/* Widget BPM */}
                <div style={dashStyles.widget} className="glass-panel">
                  <div style={dashStyles.widgetHeader}>
                    <span style={dashStyles.widgetLabel}>Frequência Cardíaca</span>
                    <Heart size={20} color="#ef4444" className={tele.freq_cardiaca > 100 ? "pulse-heart pulse-ring-danger" : "pulse-heart"} />
                  </div>
                  <div style={dashStyles.widgetValueContainer}>
                    <span style={dashStyles.widgetValue}>{tele.freq_cardiaca || '--'}</span>
                    <span style={dashStyles.widgetUnit}>BPM</span>
                  </div>
                  <div style={dashStyles.widgetFooter}>
                    <span style={{color: tele.freq_cardiaca > 100 || tele.freq_cardiaca < 60 ? '#f97316' : '#22c55e'}}>
                      {tele.freq_cardiaca > 100 ? 'Taquicardia' : tele.freq_cardiaca < 60 ? 'Bradicardia' : 'Normal'}
                    </span>
                  </div>
                </div>

                {/* Widget SpO2 */}
                <div style={dashStyles.widget} className="glass-panel">
                  <div style={dashStyles.widgetHeader}>
                    <span style={dashStyles.widgetLabel}>Saturação Oxigênio</span>
                    <Activity size={20} color="#3b82f6" />
                  </div>
                  <div style={dashStyles.widgetValueContainer}>
                    <span style={dashStyles.widgetValue}>{tele.spo2 || '--'}</span>
                    <span style={dashStyles.widgetUnit}>%</span>
                  </div>
                  <div style={dashStyles.widgetFooter}>
                    <span style={{color: tele.spo2 < 92 ? '#ef4444' : '#22c55e'}}>
                      {tele.spo2 < 92 ? 'Hipóxia Alerta' : 'Estável'}
                    </span>
                  </div>
                </div>

                {/* Widget Temperatura */}
                <div style={dashStyles.widget} className="glass-panel">
                  <div style={dashStyles.widgetHeader}>
                    <span style={dashStyles.widgetLabel}>Temperatura Corporal</span>
                    <Thermometer size={20} color="#f97316" />
                  </div>
                  <div style={dashStyles.widgetValueContainer}>
                    <span style={dashStyles.widgetValue}>{tele.temperatura || '--'}</span>
                    <span style={dashStyles.widgetUnit}>°C</span>
                  </div>
                  <div style={dashStyles.widgetFooter}>
                    <span style={{color: tele.temperatura > 37.8 ? '#ef4444' : '#22c55e'}}>
                      {tele.temperatura > 37.8 ? 'Febre' : 'Normal'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Gráfico do Histórico */}
            <div style={dashStyles.chartContainer}>
              <h3 style={dashStyles.chartTitle}>Histórico de Frequência Cardíaca (BPM)</h3>
              {history.length >= 2 ? renderSvgChart() : <div style={dashStyles.noChartData}>Aguardando dados de telemetria...</div>}
            </div>

            {/* Simulador Manual de Telemetria IoT */}
            <div style={dashStyles.simulatorPanel} className="glass-panel">
              <h4 style={dashStyles.simTitle}>Painel de Simulação IoT (Manual)</h4>
              <div style={dashStyles.simButtons}>
                <button onClick={() => triggerTelemetrySimulation(72, 98, 36.5)} style={dashStyles.simBtnNormal}>Enviar Ritmo Normal</button>
                <button onClick={() => triggerTelemetrySimulation(115, 87, 38.2)} style={dashStyles.simBtnCritico}>Simular Taquicardia + SpO2 Baixo</button>
                <button onClick={() => triggerTelemetrySimulation()} style={dashStyles.simBtnRandom}>Enviar Sinais Randômicos</button>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Predição de Risco de IA e Ações */}
        <div style={dashStyles.rightColumn}>
          
          {/* Card Indicador de Risco IA (Modelo Predição) */}
          <div style={dashStyles.card} className="glass-panel">
            <div style={dashStyles.cardHeader}>
              <h2 style={dashStyles.cardTitle}>Análise Preditiva de Risco Cardíaco</h2>
              <Brain size={20} color="#ef4444" />
            </div>

            <div style={dashStyles.riskContent}>
              {/* Gauge de Probabilidade */}
              <div style={dashStyles.gaugeContainer}>
                <svg viewBox="0 0 100 55" style={dashStyles.gaugeSvg}>
                  {/* Fundo do Gauge */}
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
                  {/* Arco Colorido Conforme Risco */}
                  <path 
                    d="M 10 50 A 40 40 0 0 1 90 50" 
                    fill="none" 
                    stroke={getRiskColor(assessment.classificacao_risco)} 
                    strokeWidth="8" 
                    strokeLinecap="round"
                    strokeDasharray="125"
                    strokeDashoffset={125 - (125 * (assessment.probabilidade_pico_risco || 0))}
                    style={{transition: 'stroke-dashoffset 0.8s ease, stroke 0.8s ease'}}
                  />
                  {/* Texto de Porcentagem */}
                  <text x="50" y="44" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="Outfit">
                    {assessment.probabilidade_pico_risco ? `${(assessment.probabilidade_pico_risco * 100).toFixed(1)}%` : '0%'}
                  </text>
                </svg>
                <div style={dashStyles.gaugeLabel}>Probabilidade de Pico de Risco</div>
              </div>

              {/* Status de Risco Textual */}
              <div style={{
                ...dashStyles.riskStatusBox, 
                backgroundColor: `${getRiskColor(assessment.classificacao_risco)}15`,
                borderColor: `${getRiskColor(assessment.classificacao_risco)}50`
              }}>
                <span style={dashStyles.riskStatusLabel}>Classificação IA:</span>
                <span style={{
                  ...dashStyles.riskStatusValue,
                  color: getRiskColor(assessment.classificacao_risco),
                  textShadow: `0 0 8px ${getRiskColor(assessment.classificacao_risco)}40`
                }}>
                  {(assessment.classificacao_risco || 'baixo').toUpperCase()}
                </span>
              </div>

              {/* Recomendações e Protocolos */}
              <div style={dashStyles.protocolsSection}>
                <div style={dashStyles.sectionTitle}>
                  <ClipboardList size={16} style={{marginRight: '6px'}} />
                  <span>Protocolos Clínicos Recomendados</span>
                </div>
                <ul style={dashStyles.protocolList}>
                  {assessment.protocolos_sugeridos && assessment.protocolos_sugeridos.map((proto, idx) => (
                    <li key={idx} style={dashStyles.protocolItem}>
                      <ChevronRight size={14} color="#3b82f6" style={{flexShrink: 0, marginTop: '3px'}} />
                      <span>{proto}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Botão de Triagem Avançada Multiagente */}
              {userRole === 'medico' && (
                <div style={dashStyles.triagemSection}>
                  <button 
                    onClick={runTriagemAvançada} 
                    disabled={triagemLoading}
                    style={dashStyles.btnTriagem}
                  >
                    {triagemLoading ? 'Agentes Colaborando...' : 'Executar Triagem Multiagente (Fase 6)'}
                  </button>
                  <p style={dashStyles.triagemHint}>
                    Dispara o fluxo de agentes com handoffs (Orquestrador → Analista ML → Especialista em Protocolos) validando a governança médica.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Detalhes do Relatório Multiagente de Triagem */}
          {triagemResult && (
            <div style={dashStyles.card} className="glass-panel animate-slide-up">
              <div style={dashStyles.cardHeader}>
                <h2 style={dashStyles.cardTitle}>Decisão Estruturada da IA Multiagente</h2>
                <CheckCircle size={18} color="#22c55e" />
              </div>
              <div style={dashStyles.triagemResultContent}>
                <div style={dashStyles.triagemMeta}>
                  <span style={dashStyles.triagemMetaItem}>Classificação: <strong>{triagemResult.classificacao_risco.toUpperCase()}</strong></span>
                  <span style={dashStyles.triagemMetaItem}>Confiança: <strong>{(triagemResult.probabilidade_pico_risco * 100).toFixed(2)}%</strong></span>
                </div>
                <div style={dashStyles.triagemNotasBox}>
                  <div style={dashStyles.triagemNotasTitle}>Notas da Junta Médica IA:</div>
                  <p style={dashStyles.triagemNotasText}>{triagemResult.notas}</p>
                </div>
                <div style={dashStyles.governanceAlert}>
                  <ShieldAlert size={16} color="#22c55e" style={{marginRight: '6px', flexShrink: 0}} />
                  <span style={{fontSize: '11px', color: '#cbd5e1'}}>Decisão auditada e registrada em <code>decisoes_cardio_ia.jsonl</code>.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Widget de Chatbot Conversacional CardioIA (Fase 5) */}
      <div style={chatStyles.container}>
        {!chatOpen ? (
          <button onClick={() => { setChatOpen(true); ensureChatSession(); }} style={chatStyles.triggerBtn} className="pulse-heart">
            <MessageSquare size={24} />
            <span style={chatStyles.badge}>CardioIA</span>
          </button>
        ) : (
          <div style={chatStyles.chatBox} className="glass-panel animate-slide-up">
            {/* Header do Chat */}
            <div style={chatStyles.chatHeader}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <Brain size={18} color="#ef4444" />
                <div>
                  <div style={chatStyles.chatTitle}>Triagem Conversacional</div>
                  <div style={chatStyles.chatStatus}>Conectado</div>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} style={chatStyles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            {/* Mensagens do Chat */}
            <div style={chatStyles.messagesContainer}>
              {chatMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  style={{
                    ...chatStyles.messageRow,
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    ...chatStyles.messageBubble,
                    backgroundColor: msg.role === 'user' ? '#2563eb' : 'rgba(30, 41, 59, 0.9)',
                    border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px'
                  }}>
                    <p style={chatStyles.messageText}>{msg.text}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={chatStyles.messageRow}>
                  <div style={{...chatStyles.messageBubble, backgroundColor: 'rgba(30, 41, 59, 0.5)'}}>
                    <span style={chatStyles.messageText}>Analisando...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input de Mensagem */}
            <div style={chatStyles.inputRow}>
              <input
                type="text"
                placeholder="Digite sobre sintomas ou dúvidas..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                style={chatStyles.chatInput}
                disabled={chatLoading}
              />
              <button onClick={sendChatMessage} style={chatStyles.sendBtn} disabled={chatLoading}>
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={dashStyles.footer}>
        <p>CardioIA Fase 7 — Integração Transdisciplinar (FastAPI + React + MicroPython + Multiagentes + Watson/OpenAI)</p>
      </footer>
    </div>
  );
}

// Estilos inline para simplicidade e ausência de bugs de deploy
const loginStyles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '430px',
    padding: '40px 30px',
    borderRadius: '24px',
    textAlign: 'center',
  },
  header: {
    marginBottom: '30px',
  },
  iconContainer: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '64px',
    height: '64px',
    borderRadius: '20px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    marginBottom: '16px',
  },
  title: {
    fontFamily: 'Outfit, sans-serif',
    fontSize: '28px',
    fontWeight: '800',
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#94a3b8',
    marginTop: '6px',
  },
  form: {
    textAlign: 'left',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
  },
  input: {
    width: '100%',
    padding: '14px 14px 14px 44px',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '10px',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
    transition: 'background-color 0.2s ease',
  },
  error: {
    color: '#ef4444',
    fontSize: '13px',
    marginBottom: '14px',
    textAlign: 'center',
  },
  divider: {
    margin: '25px 0',
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dividerText: {
    fontSize: '11px',
    color: '#64748b',
    backgroundColor: 'transparent',
    padding: '0 10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  quickButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  quickButtonPrimary: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    color: '#60a5fa',
    border: '1px solid rgba(37, 99, 235, 0.3)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  quickButtonSecondary: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  }
};

const dashStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    gap: '24px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 28px',
    borderRadius: '20px',
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  logoText: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#fff',
    lineHeight: '1.2',
  },
  logoSubText: {
    fontSize: '11px',
    color: '#64748b',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  userInfoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  roleBadge: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '20px',
    color: '#fbbf24',
    fontSize: '12px',
    fontWeight: '600',
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
    fontSize: '14px',
    color: '#cbd5e1',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    color: '#f87171',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.8fr',
    gap: '24px',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  card: {
    padding: '24px',
    borderRadius: '20px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Outfit, sans-serif',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
  },
  patientDetails: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px 16px',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255,255,255,0.03)',
    borderRadius: '10px',
  },
  detailLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#e2e8f0',
  },
  widgetsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '16px',
    marginBottom: '20px',
  },
  widget: {
    padding: '16px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  widgetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  widgetLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  widgetValueContainer: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  },
  widgetValue: {
    fontSize: '32px',
    fontWeight: '800',
    fontFamily: 'Outfit, sans-serif',
    color: '#fff',
  },
  widgetUnit: {
    fontSize: '14px',
    color: '#64748b',
  },
  widgetFooter: {
    fontSize: '12px',
    fontWeight: '600',
  },
  chartContainer: {
    padding: '16px',
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    border: '1px solid rgba(255,255,255,0.03)',
    borderRadius: '16px',
    marginBottom: '20px',
  },
  chartTitle: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '12px',
    fontWeight: '600',
  },
  svg: {
    width: '100%',
    height: 'auto',
    maxHeight: '120px',
  },
  noChartData: {
    height: '80px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#64748b',
    fontSize: '13px',
  },
  simulatorPanel: {
    padding: '16px',
    borderRadius: '16px',
    backgroundColor: 'rgba(239, 68, 68, 0.02)',
    border: '1px solid rgba(239, 68, 68, 0.08)',
  },
  simTitle: {
    fontSize: '12px',
    color: '#f87171',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: '12px',
  },
  simButtons: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  simBtnNormal: {
    padding: '8px 14px',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    color: '#4ade80',
    border: '1px solid rgba(34, 197, 94, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
  },
  simBtnCritico: {
    padding: '8px 14px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
  },
  simBtnRandom: {
    padding: '8px 14px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
  },
  riskContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  gaugeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '10px 0',
  },
  gaugeSvg: {
    width: '180px',
  },
  gaugeLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  riskStatusBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    borderRadius: '12px',
    borderWidth: '1px',
    borderStyle: 'solid',
  },
  riskStatusLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#cbd5e1',
  },
  riskStatusValue: {
    fontSize: '18px',
    fontWeight: '800',
    fontFamily: 'Outfit, sans-serif',
  },
  protocolsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '700',
    color: '#fff',
  },
  protocolList: {
    listStyleType: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  protocolItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: '1.4',
  },
  triagemSection: {
    marginTop: '10px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  btnTriagem: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
    transition: 'all 0.2s',
  },
  triagemHint: {
    fontSize: '11px',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: '1.4',
  },
  triagemResultContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  triagemMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#cbd5e1',
  },
  triagemNotasBox: {
    padding: '14px',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '10px',
  },
  triagemNotasTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#3b82f6',
    marginBottom: '6px',
    textTransform: 'uppercase',
  },
  triagemNotasText: {
    fontSize: '13px',
    color: '#e2e8f0',
    lineHeight: '1.5',
  },
  governanceAlert: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
    border: '1px solid rgba(34, 197, 94, 0.15)',
    borderRadius: '8px',
  },
  setupForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  formRow: {
    display: 'flex',
    gap: '10px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formGroupHalf: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  formInput: {
    padding: '10px 14px',
    backgroundColor: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  formActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '6px',
  },
  btnSave: {
    padding: '10px 14px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnCancel: {
    padding: '10px 14px',
    backgroundColor: 'transparent',
    color: '#cbd5e1',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  dashErrorBox: {
    padding: '16px',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '12px',
    color: '#f87171',
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
  },
  footer: {
    textAlign: 'center',
    padding: '24px 0',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    color: '#64748b',
    fontSize: '11px',
  }
};

const chatStyles = {
  container: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 9999,
  },
  triggerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '30px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 8px 30px rgba(37, 99, 235, 0.4)',
  },
  badge: {
    fontSize: '11px',
    padding: '2px 8px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: '10px',
  },
  chatBox: {
    width: '370px',
    height: '500px',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chatHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  chatTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#fff',
  },
  chatStatus: {
    fontSize: '11px',
    color: '#22c55e',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
  },
  messagesContainer: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageRow: {
    display: 'flex',
    width: '100%',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: '12px 16px',
  },
  messageText: {
    fontSize: '13px',
    color: '#e2e8f0',
    lineHeight: '1.4',
    wordBreak: 'break-word',
  },
  inputRow: {
    padding: '14px 20px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    gap: '10px',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  chatInput: {
    flex: 1,
    padding: '10px 14px',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
  },
  sendBtn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '36px',
    height: '36px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
  }
};

export default App;
