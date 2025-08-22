import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc, query, where, setDoc, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- CONFIGURAÇÃO E ELEMENTOS GLOBAIS ---
const UPLOADCARE_PUBLIC_KEY = "42770f8d4d631daceb62";
let uploadedFileInfo = null;

const loader = document.getElementById('loader');
const adminEmailSpan = document.getElementById('admin-email');
const pageTitle = document.getElementById('page-title');
const adminNav = document.getElementById('admin-nav');
const contentSections = document.querySelectorAll('.content-section');

// --- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DO PAINEL ---
function initializePanel(user) {
    adminEmailSpan.textContent = `Bem-vindo, ${user.email}`;
    loader.style.display = 'none';
    setupNavigation();
    handleRouteChange();
    setupEventListeners();
}

// --- AUTENTICAÇÃO ---
onAuthStateChanged(auth, (user) => user ? initializePanel(user) : window.location.href = 'index.html');

// --- NAVEGAÇÃO ---
function handleRouteChange() {
    const hash = window.location.hash || '#dashboard';
    const targetId = hash.substring(1);
    
    contentSections.forEach(section => section.classList.remove('active'));
    document.getElementById(`${targetId}-content`).classList.add('active');

    adminNav.querySelectorAll('li').forEach(li => li.classList.remove('active'));
    adminNav.querySelector(`li[data-target="${targetId}"]`).classList.add('active');
    
    pageTitle.textContent = targetId.charAt(0).toUpperCase() + targetId.slice(1);

    switch(targetId) {
        case 'dashboard': updateDashboardView(); break;
        case 'documentos': fetchAndRenderDocuments(); break;
        case 'projetos': fetchAndRenderProjects(); break;
        case 'institucional': loadInstitucionalContent(); break;
        case 'mensagens': fetchAndRenderMensagens(); break;
    }
}

function setupNavigation() {
    window.addEventListener('hashchange', handleRouteChange);
}

// --- DASHBOARD COM GRÁFICOS ---
async function updateDashboardView() {
    const [docsSnap, projectsSnap, messagesSnap] = await Promise.all([
        getDocs(collection(db, "documentos")),
        getDocs(collection(db, "projetos")),
        getDocs(collection(db, "contatos"))
    ]);

    const docCategories = {};
    docsSnap.forEach(doc => {
        const category = doc.data().category || "Sem Categoria";
        docCategories[category] = (docCategories[category] || 0) + 1;
    });
    renderDocCategoryChart(Object.keys(docCategories), Object.values(docCategories));

    const projectStatus = { "Em Execução": 0, "Concluído": 0 };
    projectsSnap.forEach(doc => {
        const status = doc.data().status;
        if (projectStatus.hasOwnProperty(status)) { projectStatus[status]++; }
    });
    renderProjectStatusChart(Object.keys(projectStatus), Object.values(projectStatus));
    
    const monthlyActivity = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    [docsSnap, projectsSnap, messagesSnap].forEach(snapshot => {
        snapshot.forEach(doc => {
            const docData = doc.data();
            const docDate = docData.createdAt?.toDate() || new Date(docData.data);
            if (docDate && docDate >= sixMonthsAgo) {
                const monthYear = `${docDate.getFullYear()}-${String(docDate.getMonth() + 1).padStart(2, '0')}`;
                monthlyActivity[monthYear] = (monthlyActivity[monthYear] || 0) + 1;
            }
        });
    });

    const sortedMonths = Object.keys(monthlyActivity).sort();
    const activityLabels = sortedMonths.map(my => new Date(my + '-02').toLocaleDateString('pt-BR', {month: 'short', year: 'numeric'}));
    const activityData = sortedMonths.map(my => monthlyActivity[my]);
    renderMonthlyActivityChart(activityLabels, activityData);
}

// --- FUNÇÕES DE RENDERIZAÇÃO DOS GRÁFICOS ---
function renderDocCategoryChart(labels, data) {
    const wrapper = document.getElementById('docCategoryChartWrapper');
    wrapper.innerHTML = '<canvas id="docCategoryChart"></canvas>';
    const ctx = document.getElementById('docCategoryChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: ['#0a6a0a', '#ffdd00', '#343A40', '#6C757D'], hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderProjectStatusChart(labels, data) {
    const wrapper = document.getElementById('projectStatusChartWrapper');
    wrapper.innerHTML = '<canvas id="projectStatusChart"></canvas>';
    const ctx = document.getElementById('projectStatusChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie', data: { labels, datasets: [{ data, backgroundColor: ['#0a6a0a', '#ffdd00'], hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderMonthlyActivityChart(labels, data) {
    const wrapper = document.getElementById('monthlyActivityChartWrapper');
    wrapper.innerHTML = '<canvas id="monthlyActivityChart"></canvas>';
    const ctx = document.getElementById('monthlyActivityChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar', data: { labels, datasets: [{ label: 'Novos Itens Cadastrados', data, backgroundColor: '#0a6a0a' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

// --- FUNÇÕES DE RENDERIZAÇÃO DE TABELAS ---
const renderTable = (tbody, snapshot, renderRow) => {
    tbody.innerHTML = snapshot.empty ? `<tr><td colspan="4">Nenhum item encontrado.</td></tr>` : '';
    snapshot.forEach(doc => tbody.innerHTML += renderRow(doc));
};

const fetchAndRenderDocuments = async () => {
    const tbody = document.getElementById('documentos-table-body');
    renderTable(tbody, await getDocs(collection(db, "documentos")), doc => {
        const data = doc.data();
        return `<tr><td data-label="Título"><a href="${data.fileURL}" target="_blank">${data.title}</a></td><td data-label="Categoria">${data.category}</td><td data-label="Ações" class="actions"><button class="btn-icon btn-danger delete-btn" data-type="documento" data-id="${doc.id}"><i class="fas fa-trash"></i></button></td></tr>`;
    });
};

const fetchAndRenderProjects = async () => {
    const tbody = document.getElementById('projetos-table-body');
    renderTable(tbody, await getDocs(collection(db, "projetos")), doc => {
        const data = doc.data();
        return `<tr><td data-label="Título">${data.title}</td><td data-label="Status">${data.status}</td><td data-label="Ações" class="actions"><button class="btn-icon btn-danger delete-btn" data-type="projeto" data-id="${doc.id}"><i class="fas fa-trash"></i></button></td></tr>`;
    });
};

const fetchAndRenderMensagens = async () => {
    const tbody = document.getElementById('mensagens-table-body');
    renderTable(tbody, await getDocs(collection(db, "contatos")), doc => {
        const data = doc.data();
        const date = new Date(data.data).toLocaleDateString('pt-BR');
        return `<tr><td data-label="Remetente">${data.nome}</td><td data-label="E-mail">${data.email}</td><td data-label="Data">${date}</td><td data-label="Ações" class="actions">
            <button class="btn-icon view-btn" data-nome="${data.nome}" data-email="${data.email}" data-data="${date}" data-mensagem="${data.mensagem}"><i class="fas fa-eye"></i></button>
            <button class="btn-icon btn-danger delete-btn" data-type="mensagem" data-id="${doc.id}"><i class="fas fa-trash"></i></button>
        </td></tr>`;
    });
};

const loadInstitucionalContent = async () => {
    const form = document.getElementById('institucional-form');
    const docRef = doc(db, 'conteudo', 'institucional');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        form['inst-missao'].value = data.missao || '';
        form['inst-visao'].value = data.visao || '';
        form['inst-diretoria'].value = data.diretoria || '';
    }
};

// --- FUNÇÃO PARA CONFIGURAR TODOS OS EVENT LISTENERS ---
function setupEventListeners() {
    // CORREÇÃO: LÓGICA DO MENU RESPONSIVO MOVIDA PARA CÁ
    const menuToggle = document.getElementById('admin-menu-toggle');
    const overlay = document.getElementById('admin-overlay');
    const navLinks = document.querySelectorAll('#admin-nav a');
    const closeMenu = () => document.body.classList.remove('sidebar-open');
    menuToggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    overlay.addEventListener('click', closeMenu);
    navLinks.forEach(link => link.addEventListener('click', closeMenu));

    // Listener de Logout
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth).then(() => window.location.href = 'index.html'));
    
    // Listener do botão de Upload de Documento
    const docSubmitBtn = document.getElementById('doc-submit-btn');
    document.getElementById('upload-doc-btn').addEventListener('click', () => {
        const dialog = uploadcare.openDialog(null, { publicKey: UPLOADCARE_PUBLIC_KEY, tabs: 'file url', locale: 'pt' });
        dialog.done(file => file.done(info => {
            uploadedFileInfo = info;
            document.getElementById('doc-file-info').textContent = `Arquivo selecionado: ${info.name}`;
            docSubmitBtn.disabled = false;
        }));
    });

    // Listener do formulário de Documentos
    document.getElementById('add-document-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        if (!uploadedFileInfo) { alert("Por favor, selecione um arquivo."); return; }
        loader.style.display = 'flex';
        try {
            await addDoc(collection(db, "documentos"), { title: form['doc-title'].value, category: form['doc-category'].value, fileURL: uploadedFileInfo.cdnUrl, fileUUID: uploadedFileInfo.uuid, createdAt: Timestamp.now() });
            form.reset();
            document.getElementById('doc-file-info').textContent = 'Nenhum arquivo selecionado.';
            uploadedFileInfo = null;
            docSubmitBtn.disabled = true;
            fetchAndRenderDocuments();
        } catch (error) { alert("Erro ao salvar documento."); } 
        finally { loader.style.display = 'none'; }
    });

    // Listener do formulário de Projetos
    document.getElementById('add-project-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        loader.style.display = 'flex';
        try {
            await addDoc(collection(db, "projetos"), { title: form['project-title'].value, description: form['project-desc'].value, status: form['project-status'].value, createdAt: Timestamp.now() });
            form.reset();
            fetchAndRenderProjects();
        } catch (error) { alert("Erro ao salvar projeto."); }
        finally { loader.style.display = 'none'; }
    });
    
    // Listener do formulário de Conteúdo Institucional
    const institucionalForm = document.getElementById('institucional-form');
    institucionalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loader.style.display = 'flex';
        const data = { missao: institucionalForm['inst-missao'].value, visao: institucionalForm['inst-visao'].value, diretoria: institucionalForm['inst-diretoria'].value };
        try {
            await setDoc(doc(db, 'conteudo', 'institucional'), data, { merge: true });
            alert("Conteúdo salvo com sucesso!");
        } catch (error) { alert("Erro ao salvar conteúdo."); }
        finally { loader.style.display = 'none'; }
    });
    
    // Listener genérico para ações (Excluir, Visualizar)
    document.body.addEventListener('click', async (e) => {
        const target = e.target.closest('.delete-btn, .view-btn, .modal-close-btn, .modal');
        if (!target) return;
        
        if (target.matches('.delete-btn')) {
            const docId = target.dataset.id;
            const type = target.dataset.type;
            const collectionName = type === 'mensagem' ? 'contatos' : `${type}s`;
            if (confirm(`Tem certeza que deseja excluir este(a) ${type}?`)) {
                loader.style.display = 'flex';
                try {
                    await deleteDoc(doc(db, collectionName, docId));
                    alert(`${type} excluído(a) com sucesso!`);
                    handleRouteChange();
                } catch (error) { alert("Erro ao excluir."); } 
                finally { loader.style.display = 'none'; }
            }
        } else if (target.matches('.view-btn')) {
            const modal = document.getElementById('message-modal');
            document.getElementById('modal-sender').textContent = target.dataset.nome;
            document.getElementById('modal-email').textContent = target.dataset.email;
            document.getElementById('modal-date').textContent = target.dataset.data;
            document.getElementById('modal-message-body').textContent = target.dataset.mensagem;
            modal.style.display = 'block';
        } else if (target.matches('.modal-close-btn') || target.matches('.modal')) {
            document.getElementById('message-modal').style.display = 'none';
        }
    });
}