// ==UserScript==
// @name         Copiar Dados ONU - JoaoAGS (v1.6 Fix)
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Ajuste de botões fixos e navegação interna sem reload
// @author       Joao Augusto
// @match        https://autoisp.gegnet.com.br/*
// @match        https://autoisp.acessoline.net.br/*
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    const clean = (str) => str ? str.replace(/\s+/g, ' ').trim() : '';

    // --- FUNÇÕES DE BUSCA ---
    function buscarValor(labels) {
        const alvos = Array.isArray(labels) ? labels : [labels];
        for (const label of alvos) {
            const el = Array.from(document.querySelectorAll('th, td, label, .info-label'))
                            .find(e => clean(e.textContent).toLowerCase().includes(label.toLowerCase()));
            if (el) {
                const valor = el.nextElementSibling ? clean(el.nextElementSibling.textContent) : clean(el.parentElement.innerText.replace(label, ''));
                if (valor) return valor;
            }
        }
        return '---';
    }

    function pegarSerial() {
        // Tenta pegar o serial destacado (geralmente em badges ou h3)
        const possiveis = Array.from(document.querySelectorAll('.badge, h3, h4, .text-end, b'));
        const regex = /^[A-Z0-9]{12,16}$/;
        for (let p of possiveis) {
            let txt = clean(p.textContent).replace(/[^A-Z0-9]/gi, '');
            if (regex.test(txt)) return txt;
        }
        return buscarValor(['Serial', 'ID do Fabricante', 'SN']);
    }

    // --- INTERFACE (BOTÕES FIXOS) ---
    function injetarContainer() {
        let container = document.getElementById('wrapper-botoes-joao');
        if (!container) {
            container = document.createElement('div');
            container.id = 'wrapper-botoes-joao';
            container.style.cssText = 'position: fixed; top: 10px; right: 20px; z-index: 9999; display: flex; gap: 10px; background: rgba(255,255,255,0.9); padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); border: 1px solid #ccc;';
            document.body.appendChild(container);
        }
        return container;
    }

    function adicionarBotao(texto, cor, onClick) {
        const container = injetarContainer();
        const btn = document.createElement('button');
        btn.innerText = texto;
        btn.style.cssText = `padding: 8px 15px; border: none; border-radius: 5px; color: white; cursor: pointer; font-weight: bold; background-color: ${cor};`;
        btn.onclick = onClick;
        container.appendChild(btn);
        return btn;
    }

    // --- LÓGICA PRINCIPAL ---
    function copiarDados(modoLoss = false) {
        const dados = {
            local: buscarValor(['Local', 'Descrição']),
            link: `${buscarValor(['OLT'])} - ${buscarValor(['PON'])}`,
            id: buscarValor(['ONU ID']),
            vlan: buscarValor(['VLAN']),
            serial: pegarSerial(),
            modelo: buscarValor(['Modelo']),
            rx: buscarValor(['Sinal ONU', 'Rx ONU'])
        };

        let msg = "";
        if (modoLoss) {
            msg = `--- TESTES ONU LOSS ---\nLocal: ${dados.local}\nLink: ${dados.link} ID: ${dados.id}\nSerial: ${dados.serial}\nModelo: ${dados.modelo}\nStatus: ONU DOWN (Link Loss)\n-----------------------`;
        } else {
            msg = `[DADOS ONU]\nLocal: ${dados.local}\nLink: ${dados.link} ID: ${dados.id}\nSerial: ${dados.serial}\nSinal: ${dados.rx}\nVLAN: ${dados.vlan}`;
        }

        GM_setClipboard(msg);
    }

    function init() {
        // Botão padrão
        adicionarBotao('📋 Copiar Dados', '#28a745', (e) => {
            const b = e.target;
            copiarDados(false);
            b.innerText = '✅ Copiado!';
            setTimeout(() => b.innerText = '📋 Copiar Dados', 2000);
        });

        // Botão Loss (apenas se detectar sinal baixo ou texto de down)
        const sinal = buscarValor(['Sinal ONU', 'Rx ONU']).toLowerCase();
        if (sinal.includes('loss') || sinal.includes('down') || sinal.includes('-40') || sinal === '---') {
            adicionarBotao('🚨 Relatório LOSS', '#dc3545', (e) => {
                const b = e.target;
                
                // Tenta trocar para aba Diagnóstico se existir, sem recarregar
                const abaDiag = Array.from(document.querySelectorAll('.nav-link')).find(a => a.innerText.includes('Diagnóstico'));
                if (abaDiag) {
                    abaDiag.click();
                    b.innerText = '⌛ Lendo...';
                    setTimeout(() => {
                        copiarDados(true);
                        b.innerText = '✅ Relatório OK!';
                        const abaGeral = Array.from(document.querySelectorAll('.nav-link')).find(a => a.innerText.includes('Geral'));
                        if (abaGeral) abaGeral.click();
                        setTimeout(() => b.innerText = '🚨 Relatório LOSS', 2000);
                    }, 1200);
                } else {
                    copiarDados(true);
                    b.innerText = '✅ Copiado!';
                    setTimeout(() => b.innerText = '🚨 Relatório LOSS', 2000);
                }
            });
        }
    }

    // Aguarda o site carregar o básico
    if (document.readyState === 'complete') {
        setTimeout(init, 1000);
    } else {
        window.addEventListener('load', () => setTimeout(init, 1000));
    }

})();
