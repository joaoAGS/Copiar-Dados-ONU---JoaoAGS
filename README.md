# 📊 Copiar Dados ONU - JoaoAGS

<div align="center">
  <img src="https://avatars.githubusercontent.com/u/179055349?v=4" alt="Logo" width="120">
  <br><br>
  
  <a href="https://raw.githubusercontent.com/joaoAGS/Copiar-Dados-ONU---JoaoAGS/main/Copiar%20Dados%20ONU%20-%20JoaoAGS.user.js">
    <img src="https://img.shields.io/badge/⬇️_Instalar_Script-v1.1-success?style=for-the-badge&logo=tampermonkey" alt="Instalar Script">
  </a>
  
  <br>
  <b>Coleta dados da ONU e gera teste de LOSS automático no AutoISP</b>
</div>

---

## ⚡ Instalação Rápida (1 Clique)

1. Certifique-se de ter a extensão **Tampermonkey** instalada no navegador.
2. **[CLIQUE AQUI PARA INSTALAR O SCRIPT](https://raw.githubusercontent.com/joaoAGS/Copiar-Dados-ONU---JoaoAGS/main/Copiar%20Dados%20ONU%20-%20JoaoAGS.user.js)**
3. Uma janela do Tampermonkey abrirá. Clique em **"Instalar"**.
4. Recarregue a página do AutoISP (F5).

---

## 📌 Como Usar

O script funciona de forma automática, não requer configuração manual:

1. Abra o contrato de um cliente no sistema **AutoISP**.
2. **Botão Verde (Copia Dados):** Clique para copiar Serial, Modelo, VLAN, Sinais e Firmware.
3. **Botão Vermelho (Teste ONU LOSS):**
    * Aparece sozinho quando o cliente está sem sinal.
    * Ao clicar, ele **navega automaticamente** até o Diagnóstico, pega o último sinal válido e volta para a tela inicial em milissegundos.
4. Cole as informações (Ctrl+V) no seu atendimento.

---

## 🛠️ Funcionalidades

* **Modo Turbo (V17):** Navegação ultrarrápida entre abas para buscar histórico de sinal sem abrir novas janelas.
* **Diagnóstico Inteligente:** Identifica a data exata da queda e o sinal anterior (antes do LOSS).
* **Scanner de Sinais:** Corrige falhas de leitura de sinais negativos (dBm) e formatos de texto incorretos.
* **Formatação Padrão:** Gera o texto pronto para O.S. e Logística.

---
*Desenvolvido por João Augusto.*