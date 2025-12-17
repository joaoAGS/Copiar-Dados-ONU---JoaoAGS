# 📊 Copiar Dados ONU - JoaoAGS

![Version](https://img.shields.io/badge/version-1.0-blue) ![Author](https://img.shields.io/badge/author-Joao%20Augusto-orange) ![Manager](https://img.shields.io/badge/manager-Tampermonkey-green)

> **[📥 CLIQUE AQUI PARA INSTALAR OU ATUALIZAR O SCRIPT](LINK_DO_SEU_SCRIPT_RAW)**

Este é um **UserScript** desenvolvido para otimizar o fluxo de trabalho de suporte técnico em provedores de internet (ISP). Ele adiciona botões automáticos na interface de gerenciamento para copiar rapidamente os dados da ONU e gerar relatórios padronizados de queda de sinal (LOSS).

## 🚀 Funcionalidades

O script adiciona dois botões principais na interface do sistema:

### 1. 📋 Copiar Dados (Botão Verde)
Copia instantaneamente todas as informações técnicas relevantes da ONU para a área de transferência, formatadas para colagem em tickets ou chats.
* **Dados copiados:** Local (OLT), Link (PON/ID), Service Port, VLAN, Modelo, Serial, Firmware, Sinais Ópticos (Rx ONU/OLT) e Uptime.

### 2. 🚨 Teste ONU LOSS (Botão Vermelho)
*Este botão aparece automaticamente apenas quando a ONU está sem sinal (LOSS/DOWN).*
* **Ação Inteligente (Turbo Mode):**
    1.  Navega automaticamente (e muito rápido) até a aba de **Diagnóstico GPON**.
    2.  Escaneia o histórico para encontrar o **último sinal válido** antes da queda e a **data exata** do evento.
    3.  Retorna para a tela inicial.
    4.  Gera e copia um relatório completo de "ONU DOWN" com o diagnóstico pré-preenchido.

## 🛠️ Instalação

### Pré-requisitos
Você precisa de uma extensão gerenciadora de scripts instalada no seu navegador:
* [Tampermonkey](https://www.tampermonkey.net/) (Recomendado para Chrome/Edge/Firefox)
* Violentmonkey

### Como instalar manualmente
1.  Clique no ícone do Tampermonkey no seu navegador e selecione **"Adicionar novo script"**.
2.  Apague qualquer código que já esteja no editor.
3.  Copie o código completo do script `Copiar Dados ONU - JoaoAGS`.
4.  Cole no editor do Tampermonkey.
5.  Pressione `Ctrl + S` ou clique em **Arquivo > Salvar**.

## 🔄 Atualizações Automáticas

Este script suporta atualização automática. Se você instalou através do link direto, o Tampermonkey verificará periodicamente se há novas versões.

Para forçar uma atualização:
1.  Abra o painel do Tampermonkey.
2.  Clique na aba "Scripts Instalados".
3.  Clique no cabeçalho "Última atualização" ou no botão de checar atualizações no script **Copiar Dados ONU - JoaoAGS**.

> **Nota para Desenvolvedores:** Certifique-se de que os campos `@updateURL` e `@downloadURL` no cabeçalho do script apontam para o arquivo `.user.js` hospedado (ex: GitHub Raw).

## ⚙️ Compatibilidade

Este script foi projetado para funcionar nos seguintes domínios de sistemas de gestão ISP (AutoISP):
* `autoisp.gegnet.com.br`
* `autoisp.acessoline.net.br`

## 🧠 Como funciona a Lógica "Turbo"

Para evitar erros manuais e agilizar o atendimento, o script possui uma lógica de navegação autônoma para casos de LOSS:
1.  **Detecção:** Identifica se o sinal atual está inválido ou marcado como "LOSS".
2.  **Busca:** Se o histórico não estiver visível, ele simula um clique na aba de diagnóstico.
3.  **Varredura:** Analisa a tabela de histórico de status procurando o primeiro valor numérico válido (ex: `-22.50 dBm`) na coluna "Anterior" ou "Atual".
4.  **Retorno:** Assim que encontra o dado, volta para a tela geral em milissegundos.

## 📝 Exemplo de Saída

**Ao clicar em "Copiar Dados":**
```text
[DADOS DA ONU]
Local: CE-CENTRO-xxx
Link: olt-01 1/1/1 ID 10
Service Port: 1234
VLAN: 100
Modelo: AN5506-01-A1
Serial: FHTT123456
Firmware: RP2520
Rx ONU: -19.50 dBm (UP)
Rx OLT: -20.00 dBm
Uptime: 05 dias, 10:20:30