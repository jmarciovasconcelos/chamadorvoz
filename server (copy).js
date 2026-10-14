const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const AUDIO_FILE = path.join(__dirname, 'temp_audio.mp3');
const CONFIG_FILE = path.join(__dirname, 'config.json');

// --- CONFIGURAÇÃO DA PASTA DE IMAGEM ---
const PASTA_IMAGEM = path.join(__dirname, 'imagem');
if (!fs.existsSync(PASTA_IMAGEM)) {
    fs.mkdirSync(PASTA_IMAGEM, { recursive: true });
}
app.use('/imagem', express.static(PASTA_IMAGEM));

// --- CONFIGURAÇÃO PADRÃO ---
const DEFAULT_CONFIG = {
    voz: "pt-BR-FranciscaNeural",
    velocidade: "+0%",
    mensagens: [
        "Comparecer à coordenação",
        "Sua mãe chegou na recepção",
        "Trazer o material de artes",
        "Dirija-se à saída",
        "Aguarde na sala de aula"
    ],
    ativa: 0,
    turmas: {
        "6º Ano": ["Ana", "Bruno", "Carlos"],
        "7º Ano": ["Fernanda", "Gabriel"],
        "8º Ano": ["Karen", "Leonardo"],
        "9º Ano": ["Paulo", "Quezia"],
        "1º Col": ["Roberto", "Sandra"],
        "2º Col": ["Tatiana", "Ubaldo"],
        "3º Col": ["Valéria", "Xavier"]
    }
};

const VOZES_DISPONIVEIS = [
    { id: "pt-BR-FranciscaNeural", nome: "👩 Francisca (Suave)" },
    { id: "pt-BR-AntonioNeural",   nome: "👨 Antônio (Masculina)" },
    { id: "pt-BR-ThalitaNeural",   nome: "👧 Thalita (Jovem)" }
];

function carregarConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const dados = JSON.parse(fs.readFileSync(CONFIG_FILE));
            return { ...DEFAULT_CONFIG, ...dados };
        }
    } catch (e) { console.error("Erro config"); }
    return DEFAULT_CONFIG;
}

function salvarConfig(dados) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(dados, null, 2));
}

let configAtual = carregarConfig();

// --- FRONTEND (HTML COMPLETO) ---
const getHtml = () => `
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>Painel Escolar Pro</title>
    
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#2c3e50">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <link rel="apple-touch-icon" href="/imagem/mic.png">

    <style>
        body { 
            font-family: 'Segoe UI', sans-serif; background-color: #2c3e50; color: #ecf0f1; 
            display: flex; flex-direction: column; align-items: center; min-height: 100vh; margin: 0; padding: 10px;
            padding-top: env(safe-area-inset-top);
            padding-bottom: 50px;
        }
        
        .config-area {
            background: rgba(0,0,0,0.2); 
            padding: 10px; border-radius: 10px; 
            width: 100%; max-width: 900px; margin-bottom: 10px; border: 1px solid #34495e;
        }

        .msg-row {
            display: flex; align-items: center; gap: 10px; 
            margin-bottom: 2px; background: rgba(255,255,255,0.05); 
            padding: 4px; border-radius: 6px;
        }
        input[type="radio"] { transform: scale(2.0); cursor: pointer; accent-color: #2ecc71; margin-left: 5px; margin-right: 5px; }
        input[type="text"] { 
            flex-grow: 1; padding: 8px; font-size: 16px; 
            border-radius: 4px; border: none; color: #333; background: #ecf0f1;
            transition: all 0.3s; height: 35px; 
        }
        input[type="text"]:disabled { background: rgba(255,255,255,0.1); color: #bdc3c7; }
        
        .btn-row { display: flex; gap: 5px; margin-top: 5px; width: 100%; }
        .btn-action { padding: 10px; font-size: 15px; font-weight: bold; cursor: pointer; border: none; border-radius: 5px; flex: 1; color: white;}
        .btn-green { background-color: #27ae60; }
        .btn-edit { background-color: #e67e22; }

        .tabs { display: flex; gap: 3px; margin-bottom: 0px; width: 100%; max-width: 900px; overflow-x: auto; padding-bottom: 0px; -webkit-overflow-scrolling: touch;}
        
        .tab-btn { 
            flex: 1; padding: 12px; font-size: 15px; font-weight: bold; cursor: pointer; 
            background-color: #34495e; color: #bdc3c7; border: none; border-radius: 6px 6px 0 0; 
            transition: all 0.2s; white-space: nowrap; min-width: 90px;
        }
        .tab-btn.active { background-color: #2980b9; color: white; border-bottom: 3px solid #3498db; }
        
        .tab-config { 
            background-color: #2c3e50; border: 1px solid #7f8c8d; color: #f39c12; 
            min-width: 50px; flex: 0 0 auto;
        }
        .tab-config.active { background-color: #f39c12; color: #2c3e50; border-bottom: 3px solid #e67e22; }

        .class-area { background: #2980b9; padding: 10px; border-radius: 0 0 10px 10px; width: 100%; max-width: 880px; min-height: 200px; display: flex; flex-direction: column; gap: 15px;}
        .btn-turma { width: 100%; padding: 15px; background-color: #8e44ad; color: white; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; cursor: pointer; text-transform: uppercase; box-shadow: 0 3px 0 #6c3483; transition: transform 0.1s;}
        .btn-turma:hover { background-color: #9b59b6; transform: translateY(-2px); }
        .btn-turma:active { transform: translateY(2px); box-shadow: none; }
        
        .grid { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .btn-aluno { width: 48%; max-width: 140px; height: 60px; font-size: 15px; font-weight: bold; cursor: pointer; background: white; color: #2980b9; border: none; border-radius: 5px; box-shadow: 0 3px 5px rgba(0,0,0,0.2); text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; justify-content: center;}
        @media (min-width: 600px) { .btn-aluno { width: 130px; } }
        .btn-aluno:hover { transform: translateY(-2px); background: #f1c40f; color: #2c3e50; }

        #configPanel { display: none; background: #34495e; padding: 20px; border-radius: 0 0 10px 10px; width: 100%; max-width: 860px; }
        
        .voice-box {
            background: rgba(0,0,0,0.3); padding: 15px; border-radius: 6px; margin-bottom: 20px;
            display: flex; flex-direction: column; gap: 20px;
            border-left: 5px solid #2ecc71;
        }
        .voice-row { display: flex; flex-direction: column; gap: 5px; width: 100%; }
        
        select { padding: 12px; border-radius: 5px; border: none; font-size: 16px; background: #2c3e50; color: white; width: 100%; font-weight: bold; cursor: pointer; }

        input[type=range] {
            -webkit-appearance: none; width: 100%; height: 15px;
            background: #2c3e50; border-radius: 5px; outline: none; margin: 10px 0;
        }
        input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 35px; height: 35px; background: #f1c40f;
            border-radius: 50%; cursor: pointer; box-shadow: 0 0 5px rgba(0,0,0,0.5);
        }
        .rate-display { 
            background: #2c3e50; padding: 8px; border-radius: 4px; 
            font-weight: bold; color: #f1c40f; text-align: center; font-size: 18px; margin-top: 5px;
        }

        .editor-container { border: 2px dashed #7f8c8d; padding: 10px; border-radius: 10px; background: rgba(0,0,0,0.2); }
        .editor-box { background: #2c3e50; padding: 10px; margin-bottom: 10px; border-radius: 8px; position: relative; border-left: 4px solid #e67e22; }
        .editor-header { display: flex; justify-content: space-between; margin-bottom: 5px; color: #f39c12; font-weight: bold; align-items: center;}
        .btn-delete { background: #c0392b; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .btn-add { background: #2980b9; color: white; border: none; padding: 12px; border-radius: 5px; cursor: pointer; font-size: 16px; margin-bottom: 15px; width: 100%; }
        textarea { width: 96%; height: 100px; padding: 5px; border-radius: 5px; border: none; font-family: monospace; resize: vertical; font-size: 15px;}
        .btn-full { width: 100%; margin-top: 5px; padding: 12px; font-size: 15px; font-weight: bold; border-radius: 5px; border:none; cursor: pointer; }
        
        .status { margin-top: 10px; font-size: 16px; color: #bdc3c7; text-align: center; font-weight: bold;}
    </style>
</head>
<body>

    <div class="config-area">
        <div style="margin-bottom:5px; font-weight:bold; color:#bdc3c7; font-size: 16px;">💬 SELECIONE O AVISO:</div>
        ${configAtual.mensagens.map((msg, index) => `
            <div class="msg-row">
                <input type="radio" name="msgGroup" id="radio${index}" value="${index}" 
                       ${index == configAtual.ativa ? 'checked' : ''} onclick="salvarEstadoAtivo(${index})">
                <input type="text" id="inputMsg${index}" value="${msg}" disabled>
            </div>
        `).join('')}

        <div class="btn-row">
            <button class="btn-action btn-edit" onclick="habilitarEdicao()">✏️ EDITAR</button>
            <button class="btn-action btn-green" onclick="salvarMensagens()" id="btnSalvar">💾 SALVAR AVISOS</button>
        </div>
    </div>

    <div id="tabsContainer" class="tabs"></div>

    <div id="mainPanel" class="class-area">
        <button class="btn-turma" onclick="falarTurmaInteira()">
            📢 CHAMAR TODOS: <span id="lblTurma" style="font-size: 20px">...</span>
        </button>
        <hr style="width:100%; border:0; border-top:1px solid rgba(255,255,255,0.3); margin: 5px 0;">
        <div id="alunosGrid" class="grid"></div>
    </div>

    <div id="configPanel">
        <h3 style="color:#f39c12; margin-top:0;">⚙️ AJUSTES DO SISTEMA</h3>
        
        <div class="voice-box">
            
            <div class="voice-row">
                <span style="font-weight:bold; color:#bdc3c7;">🎙️ Voz do Locutor:</span>
                <select id="voiceSelect" onchange="salvarConfigAudio()">
                    ${VOZES_DISPONIVEIS.map(v => 
                        `<option value="${v.id}" ${v.id === configAtual.voz ? 'selected' : ''}>${v.nome}</option>`
                    ).join('')}
                </select>
            </div>

            <div class="voice-row">
                <span style="font-weight:bold; color:#bdc3c7;">⏩ Velocidade da Fala:</span>
                <input type="range" id="rateRange" min="-50" max="50" step="10" 
                       value="${parseInt(configAtual.velocidade) || 0}" 
                       oninput="atualizarLabelRate()" onchange="salvarConfigAudio()">
                <div id="rateLabel" class="rate-display">Normal</div>
            </div>

        </div>

        <div class="editor-container">
            <h4 style="margin-top:0; color:#bdc3c7">Gerenciamento de Turmas</h4>
            <button class="btn-add" onclick="adicionarNovaTurma()">➕ CRIAR NOVA TURMA</button>
            <div id="editorListas"></div>
            <button class="btn-full btn-green" onclick="salvarTudoEditor()">💾 SALVAR ALTERAÇÕES</button>
        </div>
    </div>
    
    <div class="status" id="status">Carregando...</div>
    <br>

    <script>
        let turmas = ${JSON.stringify(configAtual.turmas)};
        let indiceAtivo = ${configAtual.ativa};
        let chavesTurmas = Object.keys(turmas);
        let turmaAtual = chavesTurmas.length > 0 ? chavesTurmas[0] : null;
        let modoConfig = false; 

        window.onload = function() {
            renderizarAbas();
            alternarVisao('turma', turmaAtual);
            preencherEditor();
            atualizarLabelRate(); 
            document.getElementById('status').innerText = "Pronto";
        };

        function atualizarLabelRate() {
            const val = document.getElementById('rateRange').value;
            const label = document.getElementById('rateLabel');
            if(val == 0) {
                label.innerText = "Normal"; label.style.color = "#2ecc71";
            } else {
                label.innerText = (val > 0 ? "+" : "") + val + "%"; label.style.color = "#f1c40f";
            }
        }

        function salvarConfigAudio() {
            enviarConfigCompleta(null, false);
            document.getElementById('status').innerText = "Áudio ajustado!";
        }

        function renderizarAbas() {
            const container = document.getElementById('tabsContainer');
            container.innerHTML = '';
            const nomes = Object.keys(turmas);
            if(!turmas[turmaAtual] && nomes.length > 0) turmaAtual = nomes[0];

            nomes.forEach(nome => {
                const btn = document.createElement('button');
                const isActive = (!modoConfig && nome === turmaAtual);
                btn.className = 'tab-btn ' + (isActive ? 'active' : '');
                btn.innerText = nome;
                btn.onclick = () => alternarVisao('turma', nome);
                container.appendChild(btn);
            });

            // Ícone de engrenagem pequeno
            const btnConfig = document.createElement('button');
            btnConfig.className = 'tab-btn tab-config ' + (modoConfig ? 'active' : '');
            btnConfig.innerHTML = "⚙️"; 
            btnConfig.title = "Configurações";
            btnConfig.onclick = () => alternarVisao('config');
            container.appendChild(btnConfig);
        }

        function alternarVisao(tipo, nomeTurma) {
            const painelMain = document.getElementById('mainPanel');
            const painelConfig = document.getElementById('configPanel');

            if (tipo === 'config') {
                modoConfig = true;
                painelMain.style.display = 'none';
                painelConfig.style.display = 'block';
                document.getElementById('status').innerText = "Modo Ajustes";
            } else {
                modoConfig = false;
                turmaAtual = nomeTurma;
                painelMain.style.display = 'flex';
                painelConfig.style.display = 'none';
                renderizarAlunos(nomeTurma);
                document.getElementById('lblTurma').innerText = nomeTurma;
                document.getElementById('status').innerText = "Pronto";
            }
            renderizarAbas();
        }

        function renderizarAlunos(nome) {
            const grid = document.getElementById('alunosGrid');
            grid.innerHTML = '';
            if(!turmas[nome]) return;
            const lista = turmas[nome];
            if(lista.length === 0) { grid.innerHTML = '<div style="color:white; padding:20px;">Lista vazia.</div>'; return; }
            lista.forEach(aluno => {
                if(aluno.trim() !== '') {
                    const btn = document.createElement('button');
                    btn.className = 'btn-aluno';
                    btn.innerText = aluno;
                    btn.onclick = () => falar(aluno);
                    grid.appendChild(btn);
                }
            });
        }

        function falar(nome) { enviarParaAPI(nome, turmaAtual); }
        function falarTurmaInteira() { enviarParaAPI(null, turmaAtual); }

        function enviarParaAPI(nome, turma) {
            const inputMsg = document.getElementById('inputMsg' + indiceAtivo);
            const msg = inputMsg ? inputMsg.value : "";
            const textoDisplay = nome ? nome : "TODOS";
            
            feedback('Chamando: ' + textoDisplay + '...', '#f1c40f');
            
            const voz = document.getElementById('voiceSelect').value;
            let rate = document.getElementById('rateRange').value;
            const rateString = (rate >= 0 ? "+" : "") + rate + "%";

            fetch('/falar', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    nome: nome, 
                    turma: turma, 
                    mensagem: msg, 
                    voz: voz,
                    velocidade: rateString 
                })
            })
            .then(res => res.json())
            .then(data => {
                if(data.error) {
                    feedback('Erro: ' + data.error, '#e74c3c');
                } else {
                    feedback('📣 ' + data.falado, '#2ecc71');
                }
            })
            .catch(err => feedback('Erro no som', '#e74c3c'));
        }

        function preencherEditor() {
            const container = document.getElementById('editorListas');
            container.innerHTML = '';
            const nomes = Object.keys(turmas);
            nomes.forEach(nome => {
                const box = document.createElement('div');
                box.className = 'editor-box';
                const listaTexto = turmas[nome].join('\\n');
                const htmlContent = 
                    '<div class="editor-header">' +
                        '<span>' + nome + '</span>' +
                        '<button class="btn-delete" onclick="excluirTurma(\\'' + nome + '\\')">🗑️ Excluir</button>' +
                    '</div>' +
                    '<textarea id="edit_area_' + nome + '">' + listaTexto + '</textarea>';
                box.innerHTML = htmlContent;
                container.appendChild(box);
            });
        }

        function adicionarNovaTurma() {
            const novoNome = prompt("Nome da nova turma:");
            if(novoNome && novoNome.trim() !== "") {
                if(turmas[novoNome]) { alert("Já existe!"); return; }
                turmas[novoNome] = [];
                preencherEditor();
                setTimeout(() => { document.getElementById('editorListas').lastElementChild.scrollIntoView({behavior: "smooth"}); }, 100);
            }
        }

        function excluirTurma(nome) {
            if(confirm('Excluir "' + nome + '"?')) { delete turmas[nome]; preencherEditor(); }
        }

        function salvarTudoEditor() {
            const nomes = Object.keys(turmas);
            nomes.forEach(nome => {
                const textarea = document.getElementById('edit_area_' + nome);
                if(textarea) {
                    const linhas = textarea.value.split('\\n');
                    turmas[nome] = linhas.filter(l => l.trim() !== '');
                }
            });
            enviarConfigCompleta(null, true);
            const novasChaves = Object.keys(turmas);
            if (!turmas[turmaAtual] && novasChaves.length > 0) turmaAtual = novasChaves[0];
            renderizarAlunos(turmaAtual);
        }

        function habilitarEdicao() {
            for(let i=0; i<5; i++) {
                const el = document.getElementById('inputMsg'+i);
                if(el) { el.disabled = false; el.style.background = '#fff'; }
            }
            document.getElementById('status').innerText = "Editando Avisos...";
        }

        function salvarEstadoAtivo(index) { 
            indiceAtivo = index; 
            enviarConfigCompleta(null, false);
        }

        function salvarMensagens() {
            const msgs = pegarMensagensAtuais();
            for(let i=0; i<5; i++) {
                const el = document.getElementById('inputMsg'+i);
                if(el) { el.disabled = true; el.style.background = ''; }
            }
            enviarConfigCompleta(msgs, true);
        }

        function pegarMensagensAtuais() {
            const msgs = [];
            for(let i=0; i<5; i++) {
                const el = document.getElementById('inputMsg'+i);
                if(el) msgs.push(el.value);
            }
            return msgs;
        }

        function enviarConfigCompleta(msgsOpcional, mostrarFeedback = true) {
            const msgs = msgsOpcional || pegarMensagensAtuais();
            const voz = document.getElementById('voiceSelect').value;
            let rate = document.getElementById('rateRange').value;
            const rateString = (rate >= 0 ? "+" : "") + rate + "%";

            if(mostrarFeedback) feedback('Salvando...', '#f1c40f');
            
            fetch('/salvar', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    mensagens: msgs, 
                    ativa: indiceAtivo, 
                    turmas: turmas, 
                    voz: voz,
                    velocidade: rateString 
                })
            }).then(() => { if(mostrarFeedback) feedback('Salvo!', '#2ecc71'); });
        }

        function feedback(texto, cor) {
            const el = document.getElementById('status');
            el.innerText = texto; el.style.color = cor;
            setTimeout(() => { el.innerText = 'Pronto'; el.style.color = '#bdc3c7'; }, 2500);
        }
    </script>
</body>
</html>
`;

// --- ROTA DO MANIFESTO (PARA INSTALAR) ---
app.get('/manifest.json', (req, res) => {
    res.json({
        "name": "Painel Escolar", 
        "short_name": "Avisos", 
        "start_url": "/", 
        "display": "fullscreen", // <--- O SEGREDO ESTÁ AQUI
        "background_color": "#2c3e50", 
        "theme_color": "#2c3e50",
        "icons": [{ "src": "/imagem/mic.png", "sizes": "512x512", "type": "image/png" }]
    });
});

// --- ROTAS DO SERVIDOR ---
app.get('/', (req, res) => res.send(getHtml()));

app.post('/salvar', (req, res) => {
    configAtual.mensagens = req.body.mensagens;
    configAtual.ativa = req.body.ativa;
    if(req.body.turmas) configAtual.turmas = req.body.turmas;
    if(req.body.voz) configAtual.voz = req.body.voz;
    if(req.body.velocidade) configAtual.velocidade = req.body.velocidade;
    salvarConfig(configAtual);
    res.json({ success: true });
});

app.post('/falar', (req, res) => {
    const { nome, turma, mensagem, voz, velocidade } = req.body;
    let textoCompleto = "";
    if (nome && turma) textoCompleto = `${nome} do ${turma}, ${mensagem}`;
    else if (turma && !nome) textoCompleto = `Atenção ${turma}, ${mensagem}`;
    else textoCompleto = mensagem;
    
    console.log(`Falando: "${textoCompleto}"`);
    
    const vozUsar = voz || configAtual.voz || "pt-BR-FranciscaNeural";
    const rateUsar = velocidade || configAtual.velocidade || "+0%";

    const comando = `python3 -m edge_tts --voice ${vozUsar} --rate="${rateUsar}" --text "${textoCompleto}" --write-media "${AUDIO_FILE}"`;

    exec(comando, (error) => {
        if (error) {
            console.error(`Erro TTS: ${error}`);
            return res.status(500).json({ error: 'Falha no gerador de voz' });
        }
        exec(`mpg123 -q "${AUDIO_FILE}"`, (errPlay) => { if(errPlay) console.error(errPlay); });
        res.json({ success: true, falado: textoCompleto });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Escolar Rodando na porta ${PORT}`);
    if (!fs.existsSync(CONFIG_FILE)) salvarConfig(DEFAULT_CONFIG);
});
