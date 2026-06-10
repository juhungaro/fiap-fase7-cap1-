import time
import machine
import urequests
import network
import random

try:
    import ssd1306
    HAS_OLED = True
except ImportError:
    HAS_OLED = False

# Configurações de Rede (Rede WiFi virtual do simulador Wokwi)
WIFI_SSID = "Wokwi-GUEST"
WIFI_PASSWORD = ""

# URL do Backend CardioIA exposto via localtunnel (HTTP para evitar falhas de SSL no ESP32)
BACKEND_URL = "http://ten-cities-draw.loca.lt/api/iot/data"

# Configuração de Pinos do ESP32
# LEDs indicadores
PIN_LED_VERDE = 12
PIN_LED_VERMELHO = 14
led_verde = machine.Pin(PIN_LED_VERDE, machine.Pin.OUT)
led_vermelho = machine.Pin(PIN_LED_VERMELHO, machine.Pin.OUT)

# Barramento I2C para Display OLED SSD1306 (SDA=Pin 21, SCL=Pin 22 no ESP32)
i2c = machine.I2C(0, scl=machine.Pin(22), sda=machine.Pin(21))
oled = None
if HAS_OLED:
    try:
        # Inicializa o display OLED
        oled = ssd1306.SSD1306_I2C(128, 64, i2c)
        print("Display OLED inicializado com sucesso.")
    except Exception as e:
        print("Erro ao inicializar display OLED:", e)

def conectar_wifi():
    """Conecta o ESP32 à rede WiFi."""
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print("Conectando ao WiFi...")
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        
        # Aguarda conexão com limite de tempo
        tentativas = 0
        while not wlan.isconnected() and tentativas < 20:
            time.sleep(0.5)
            tentativas += 1
            print(".", end="")
    
    print("\nConectado! IP do dispositivo:", wlan.ifconfig()[0])
    return wlan.ifconfig()[0]

def atualizar_oled(bpm, spo2, temp, status_envio):
    """Renderiza os dados clínicos e status no display OLED."""
    if not oled:
        return
    try:
        oled.fill(0)
        # Header
        oled.text("   CARDIOIA IoT   ", 0, 0)
        oled.text("----------------", 0, 8)
        
        # Leituras dos Sensores
        oled.text("Batimentos: {} BPM".format(bpm), 0, 20)
        oled.text("Saturacao : {}%".format(spo2), 0, 32)
        oled.text("Temp. Corp: {}C".format(temp), 0, 44)
        
        # Status do envio
        oled.text("Status: {}".format(status_envio), 0, 56)
        oled.show()
    except Exception as e:
        print("Erro ao atualizar o display OLED:", e)

def gerenciar_leds(bpm, spo2):
    """Controle local de sinalizadores baseados na gravidade das leituras."""
    # Risco se batimentos altos ou queda de SpO2
    if bpm > 100 or spo2 < 92:
        # Liga LED vermelho e desliga verde
        led_verde.value(0)
        # Efeito pisca-pisca para emergência
        for _ in range(3):
            led_vermelho.value(1)
            time.sleep(0.1)
            led_vermelho.value(0)
            time.sleep(0.1)
    else:
        # Ritmo normal: Liga LED verde
        led_verde.value(1)
        led_vermelho.value(0)

def simular_sinais_vitais():
    """Gera dados fisiológicos plausíveis para simulação do paciente."""
    # Gera variação leve em relação a um estado basal
    # 25% de chance de simular um pico de arritmia/taquicardia
    se_crise = random.random() < 0.25
    
    if se_crise:
        bpm = random.randint(105, 135)
        spo2 = random.randint(85, 91)
        temp = round(random.uniform(37.9, 39.4), 1)
    else:
        bpm = random.randint(65, 95)
        spo2 = random.randint(95, 100)
        temp = round(random.uniform(36.1, 37.2), 1)
        
    return bpm, spo2, temp

def main():
    print("Iniciando firmware MicroPython CardioIA...")
    # Desliga LEDs ao iniciar
    led_verde.value(0)
    led_vermelho.value(0)
    
    # Exibe tela inicial
    if oled:
        oled.fill(0)
        oled.text("   CARDIOIA    ", 0, 20)
        oled.text(" Inicializando  ", 0, 32)
        oled.show()
        
    conectar_wifi()
    
    status_conexao = "WIFI OK"
    
    while True:
        # 1. Simular leituras do sensor
        bpm, spo2, temp = simular_sinais_vitais()
        print("\n--- Nova Leitura ---")
        print("Frequencia Cardiaca: {} BPM".format(bpm))
        print("Saturacao Oxigenio: {}%".format(spo2))
        print("Temperatura: {} C".format(temp))
        
        # 2. Controlar LEDs locais de gravidade
        gerenciar_leds(bpm, spo2)
        
        # 3. Atualizar o display OLED
        atualizar_oled(bpm, spo2, temp, status_conexao)
        
        # 4. Transmitir dados para o Backend via HTTP POST
        payload = {
            "paciente_id": "default_patient",
            "freq_cardiaca": float(bpm),
            "spo2": float(spo2),
            "temperatura": float(temp)
        }
        
        try:
            print("Transmitindo telemetria para", BACKEND_URL)
            res = urequests.post(
                BACKEND_URL, 
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Bypass-Tunnel-Reminder": "true"
                }
            )
            print("Resposta do Backend:", res.status_code, res.text)
            res.close()
            status_conexao = "ENVIO OK"
        except Exception as e:
            print("Falha na transmissao HTTP:", e)
            status_conexao = "ERRO CONEXAO"
            
        # Espera 5 segundos antes da próxima leitura
        time.sleep(5)

if __name__ == "__main__":
    main()
