import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc, query, where, setDoc, getDoc, Timestamp, orderBy, limit, updateDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- CONFIGURAÇÃO E ELEMENTOS GLOBAIS ---
const UPLOADCARE_PUBLIC_KEY = "SUA_CHAVE_PUBLICA_DO_UPLOADCARE";
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
        case 'doacoes': fetchAndRenderDoacoes(); break;
        case 'institucional': loadInstitucionalContent(); break;
        case 'mensagens': fetchAndRenderMensagens(); break;
    }
}

function setupNavigation() {
    window.addEventListener('hashchange', handleRouteChange);
}

// --- DASHBOARD COM GRÁFICOS ---
async function updateDashboardView() {
    updateActivityFeed(); 
    
    const [docsSnap, projectsSnap, messagesSnap, doacoesSnap] = await Promise.all([
        getDocs(collection(db, "documentos")),
        getDocs(collection(db, "projetos")),
        getDocs(collection(db, "contatos")),
        getDocs(collection(db, "doacoes"))
    ]);

    const activeProjects = projectsSnap.docs.filter(doc => doc.data().status === 'Em Execução').length;
    let totalDonations = 0;
    doacoesSnap.forEach(doc => { totalDonations += doc.data().valor; });
    
    document.getElementById('doc-count').textContent = docsSnap.size;
    document.getElementById('project-count').textContent = activeProjects;
    document.getElementById('message-count').textContent = messagesSnap.size;
    document.getElementById('donations-total').textContent = totalDonations.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const docCategories = {};
    docsSnap.forEach(doc => { const category = doc.data().category || "Sem Categoria"; docCategories[category] = (docCategories[category] || 0) + 1; });
    renderDocCategoryChart(Object.keys(docCategories), Object.values(docCategories));
    
    const projectStatus = { "Em Execução": 0, "Concluído": 0 };
    projectsSnap.forEach(doc => { const status = doc.data().status; if (projectStatus.hasOwnProperty(status)) { projectStatus[status]++; } });
    renderProjectStatusChart(Object.keys(projectStatus), Object.values(projectStatus));
    
    const monthlyDonations = {};
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); sixMonthsAgo.setHours(0,0,0,0);
    doacoesSnap.forEach(doc => {
        const docData = doc.data();
        const docDate = docData.data.toDate();
        if (docDate && docDate >= sixMonthsAgo) {
            const monthYear = `${docDate.getFullYear()}-${String(docDate.getMonth() + 1).padStart(2, '0')}`;
            monthlyDonations[monthYear] = (monthlyDonations[monthYear] || 0) + docData.valor;
        }
    });
    const sortedMonths = Object.keys(monthlyDonations).sort();
    const donationLabels = sortedMonths.map(my => new Date(my + '-02').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }));
    const donationData = sortedMonths.map(my => monthlyDonations[my]);
    renderMonthlyDonationsChart(donationLabels, donationData);
}

async function updateActivityFeed() {
    const feedList = document.getElementById('activity-feed');
    feedList.innerHTML = '<li>Carregando atividades...</li>';
    try {
        const docsQuery = query(collection(db, "documentos"), orderBy("createdAt", "desc"), limit(5));
        const projectsQuery = query(collection(db, "projetos"), orderBy("createdAt", "desc"), limit(5));
        const [docsSnap, projectsSnap] = await Promise.all([getDocs(docsQuery), getDocs(projectsQuery)]);
        const activities = [];
        docsSnap.forEach(doc => activities.push({ ...doc.data(), type: 'Documento' }));
        projectsSnap.forEach(doc => activities.push({ ...doc.data(), type: 'Projeto' }));
        activities.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        const recentActivities = activities.slice(0, 5);
        if (recentActivities.length === 0) {
            feedList.innerHTML = '<li>Nenhuma atividade recente.</li>';
            return;
        }
        feedList.innerHTML = recentActivities.map(activity => {
            const date = activity.createdAt.toDate().toLocaleDateString('pt-BR');
            const icon = activity.type === 'Documento' ? '<i class="fas fa-file-alt"></i>' : '<i class="fas fa-tasks"></i>';
            return `<li><div class="activity-icon">${icon}</div><div class="activity-info"><p>Novo ${activity.type}: <strong>${activity.title}</strong></p><span>${date}</span></div></li>`;
        }).join('');
    } catch (error) { console.error("Erro ao carregar feed:", error); feedList.innerHTML = '<li>Erro ao carregar atividades.</li>'; }
}

// --- FUNÇÕES DE RENDERIZAÇÃO DOS GRÁFICOS ---
function renderDocCategoryChart(labels, data) { const wrapper = document.getElementById('docCategoryChartWrapper'); if (!wrapper) return; wrapper.innerHTML = '<canvas id="docCategoryChart"></canvas>'; const ctx = document.getElementById('docCategoryChart').getContext('2d'); new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: ['#2F855A', '#ECC94B', '#4A5568', '#A0AEC0'], hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } }); }
function renderProjectStatusChart(labels, data) { const wrapper = document.getElementById('projectStatusChartWrapper'); if (!wrapper) return; wrapper.innerHTML = '<canvas id="projectStatusChart"></canvas>'; const ctx = document.getElementById('projectStatusChart').getContext('2d'); new Chart(ctx, { type: 'pie', data: { labels, datasets: [{ data, backgroundColor: ['#2F855A', '#ECC94B'], hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } }); }
function renderMonthlyDonationsChart(labels, data) { const wrapper = document.getElementById('monthlyDonationsChartWrapper'); if (!wrapper) return; wrapper.innerHTML = '<canvas id="monthlyDonationsChart"></canvas>'; const ctx = document.getElementById('monthlyDonationsChart').getContext('2d'); new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Arrecadação (R$)', data, backgroundColor: 'rgba(47, 133, 90, 0.2)', borderColor: '#2F855A', tension: 0.3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } }); }

// --- FUNÇÕES DE RENDERIZAÇÃO DE TABELAS ---
const renderTable = (tbody, snapshot, renderRow) => { if (!tbody) return; tbody.innerHTML = snapshot.empty ? `<tr><td colspan="4">Nenhum item encontrado.</td></tr>` : ''; snapshot.forEach(doc => tbody.innerHTML += renderRow(doc)); };
const fetchAndRenderDocuments = async () => { const tbody = document.getElementById('documentos-table-body'); renderTable(tbody, await getDocs(collection(db, "documentos")), doc => { const data = doc.data(); return `<tr><td data-label="Título"><a href="${data.fileURL}" target="_blank">${data.title}</a></td><td data-label="Categoria">${data.category}</td><td data-label="Ações" class="actions"><button class="btn-icon btn-edit edit-doc-btn" data-id="${doc.id}" data-title="${data.title}" data-category="${data.category}" title="Editar"><i class="fas fa-edit"></i></button><button class="btn-icon btn-danger delete-btn" data-type="documento" data-id="${doc.id}" title="Excluir"><i class="fas fa-trash"></i></button></td></tr>`; }); };
const fetchAndRenderProjects = async () => { const tbody = document.getElementById('projetos-table-body'); renderTable(tbody, await getDocs(collection(db, "projetos")), doc => { const data = doc.data(); return `<tr><td data-label="Título">${data.title}</td><td data-label="Status">${data.status}</td><td data-label="Ações" class="actions"><button class="btn-icon btn-edit edit-project-btn" data-id="${doc.id}" data-title="${data.title}" data-description="${data.description}" data-status="${data.status}" title="Editar"><i class="fas fa-edit"></i></button><button class="btn-icon btn-danger delete-btn" data-type="projeto" data-id="${doc.id}" title="Excluir"><i class="fas fa-trash"></i></button></td></tr>`; }); };
const fetchAndRenderMensagens = async () => { const tbody = document.getElementById('mensagens-table-body'); renderTable(tbody, await getDocs(collection(db, "contatos")), doc => { const data = doc.data(); const date = new Date(data.data).toLocaleDateString('pt-BR'); return `<tr><td data-label="Remetente">${data.nome}</td><td data-label="E-mail">${data.email}</td><td data-label="Data">${date}</td><td data-label="Ações" class="actions"><button class="btn-icon view-btn" data-nome="${data.nome}" data-email="${data.email}" data-data="${date}" data-mensagem="${data.mensagem}"><i class="fas fa-eye"></i></button><button class="btn-icon btn-danger delete-btn" data-type="mensagem" data-id="${doc.id}"><i class="fas fa-trash"></i></button></td></tr>`; }); };
const fetchAndRenderDoacoes = async () => { const tbody = document.getElementById('doacoes-table-body'); renderTable(tbody, await getDocs(collection(db, "doacoes")), doc => { const data = doc.data(); const date = data.data.toDate().toLocaleDateString('pt-BR'); const valor = data.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); return `<tr><td data-label="Doador">${data.doador || 'Anônimo'}</td><td data-label="Valor">${valor}</td><td data-label="Data">${date}</td><td data-label="Ações" class="actions"><button class="btn-icon btn-danger delete-btn" data-type="doacao" data-id="${doc.id}"><i class="fas fa-trash"></i></button></td></tr>`; }); };
const loadInstitucionalContent = async () => { const form = document.getElementById('institucional-form'); const docRef = doc(db, 'conteudo', 'institucional'); const docSnap = await getDoc(docRef); if (docSnap.exists()) { const data = docSnap.data(); form['inst-missao'].value = data.missao || ''; form['inst-visao'].value = data.visao || ''; form['inst-diretoria'].value = data.diretoria || ''; } };

// --- FUNÇÃO PARA CONFIGURAR TODOS OS EVENT LISTENERS ---
function setupEventListeners() {
    const menuToggle = document.getElementById('admin-menu-toggle');
    const overlay = document.getElementById('admin-overlay');
    const navLinks = document.querySelectorAll('#admin-nav a');
    const closeMenu = () => document.body.classList.remove('sidebar-open');
    menuToggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    overlay.addEventListener('click', closeMenu);
    navLinks.forEach(link => link.addEventListener('click', closeMenu));
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth).then(() => window.location.href = 'index.html'));
    
    const docSubmitBtn = document.getElementById('doc-submit-btn');
    document.getElementById('upload-doc-btn').addEventListener('click', () => { const dialog = uploadcare.openDialog(null, { publicKey: UPLOADCARE_PUBLIC_KEY, tabs: 'file url', locale: 'pt' }); dialog.done(file => file.done(info => { uploadedFileInfo = info; document.getElementById('doc-file-info').textContent = `${info.name}`; docSubmitBtn.disabled = false; })); });
    document.getElementById('add-document-form').addEventListener('submit', async (e) => { e.preventDefault(); const form = e.target; if (!uploadedFileInfo) { alert("Por favor, selecione um arquivo."); return; } loader.style.display = 'flex'; try { await addDoc(collection(db, "documentos"), { title: form['doc-title'].value, category: form['doc-category'].value, fileURL: uploadedFileInfo.cdnUrl, fileUUID: uploadedFileInfo.uuid, createdAt: Timestamp.now() }); form.reset(); document.getElementById('doc-file-info').textContent = 'Nenhum arquivo selecionado.'; uploadedFileInfo = null; docSubmitBtn.disabled = true; fetchAndRenderDocuments(); } catch (error) { alert("Erro ao salvar documento."); } finally { loader.style.display = 'none'; } });
    document.getElementById('add-project-form').addEventListener('submit', async (e) => { e.preventDefault(); const form = e.target; loader.style.display = 'flex'; try { await addDoc(collection(db, "projetos"), { title: form['project-title'].value, description: form['project-desc'].value, status: form['project-status'].value, createdAt: Timestamp.now() }); form.reset(); fetchAndRenderProjects(); } catch (error) { alert("Erro ao salvar projeto."); } finally { loader.style.display = 'none'; } });
    document.getElementById('add-doacao-form').addEventListener('submit', async (e) => { e.preventDefault(); const form = e.target; const doador = form['doacao-doador'].value || 'Anônimo'; const valor = parseFloat(form['doacao-valor'].value); const dataStr = form['doacao-data'].value; if (isNaN(valor) || valor <= 0) { alert("Por favor, insira um valor válido."); return; } if (!dataStr) { alert("Por favor, insira uma data válida."); return; } const data = new Date(dataStr + 'T12:00:00'); loader.style.display = 'flex'; try { await addDoc(collection(db, "doacoes"), { doador, valor, data: Timestamp.fromDate(data) }); form.reset(); fetchAndRenderDoacoes(); } catch (error) { console.error("Erro:", error); alert("Erro ao registrar doação."); } finally { loader.style.display = 'none'; } });
    const institucionalForm = document.getElementById('institucional-form');
    institucionalForm.addEventListener('submit', async (e) => { e.preventDefault(); loader.style.display = 'flex'; const data = { missao: institucionalForm['inst-missao'].value, visao: institucionalForm['inst-visao'].value, diretoria: institucionalForm['inst-diretoria'].value }; try { await setDoc(doc(db, 'conteudo', 'institucional'), data, { merge: true }); alert("Conteúdo salvo com sucesso!"); } catch (error) { alert("Erro ao salvar conteúdo."); } finally { loader.style.display = 'none'; } });
    const editDocumentForm = document.getElementById('edit-document-form');
    editDocumentForm.addEventListener('submit', async (e) => { e.preventDefault(); const docId = editDocumentForm['edit-doc-id'].value; const newData = { title: editDocumentForm['edit-doc-title'].value, category: editDocumentForm['edit-doc-category'].value }; loader.style.display = 'flex'; try { await updateDoc(doc(db, 'documentos', docId), newData); document.getElementById('edit-document-modal').style.display = 'none'; fetchAndRenderDocuments(); alert("Documento atualizado com sucesso!"); } catch (error) { console.error("Erro:", error); alert("Erro ao atualizar documento."); } finally { loader.style.display = 'none'; } });
    const editProjectForm = document.getElementById('edit-project-form');
    editProjectForm.addEventListener('submit', async (e) => { e.preventDefault(); const projectId = editProjectForm['edit-project-id'].value; const newData = { title: editProjectForm['edit-project-title'].value, description: editProjectForm['edit-project-desc'].value, status: editProjectForm['edit-project-status'].value }; loader.style.display = 'flex'; try { await updateDoc(doc(db, 'projetos', projectId), newData); document.getElementById('edit-project-modal').style.display = 'none'; fetchAndRenderProjects(); alert("Projeto atualizado com sucesso!"); } catch (error) { console.error("Erro:", error); alert("Erro ao atualizar projeto."); } finally { loader.style.display = 'none'; } });
    
    // CORREÇÃO: Lógica de eventos movida para uma função mais específica
    setupActionListeners();
}

function setupActionListeners() {
    document.body.addEventListener('click', async (e) => {
        // ABRIR MODAIS
        if (e.target.closest('.edit-doc-btn')) {
            const button = e.target.closest('.edit-doc-btn');
            const modal = document.getElementById('edit-document-modal');
            modal.querySelector('#edit-doc-id').value = button.dataset.id;
            modal.querySelector('#edit-doc-title').value = button.dataset.title;
            modal.querySelector('#edit-doc-category').value = button.dataset.category;
            modal.style.display = 'block';
        } 
        else if (e.target.closest('.edit-project-btn')) {
            const button = e.target.closest('.edit-project-btn');
            const modal = document.getElementById('edit-project-modal');
            modal.querySelector('#edit-project-id').value = button.dataset.id;
            modal.querySelector('#edit-project-title').value = button.dataset.title;
            modal.querySelector('#edit-project-desc').value = button.dataset.description;
            modal.querySelector('#edit-project-status').value = button.dataset.status;
            modal.style.display = 'block';
        }
        else if (e.target.closest('.view-btn')) {
            const button = e.target.closest('.view-btn');
            const modal = document.getElementById('message-modal');
            modal.querySelector('#modal-sender').textContent = button.dataset.nome;
            modal.querySelector('#modal-email').textContent = button.dataset.email;
            modal.querySelector('#modal-date').textContent = button.dataset.data;
            modal.querySelector('#modal-message-body').textContent = button.dataset.mensagem;
            modal.style.display = 'block';
        }
        // DELETAR
        else if (e.target.closest('.delete-btn')) {
            const button = e.target.closest('.delete-btn');
            const docId = button.dataset.id;
            const type = button.dataset.type;
            let collectionName = `${type}s`;
            if (type === 'mensagem') collectionName = 'contatos';
            if (type === 'doacao') collectionName = 'doacoes';
            
            if (confirm(`Tem certeza que deseja excluir este(a) ${type}?`)) {
                loader.style.display = 'flex';
                try {
                    await deleteDoc(doc(db, collectionName, docId));
                    alert(`${type} excluído(a) com sucesso!`);
                    handleRouteChange();
                } catch (error) { alert("Erro ao excluir."); } 
                finally { loader.style.display = 'none'; }
            }
        }
        // FECHAR MODAIS
        else if (e.target.matches('.modal-close-btn') || e.target.matches('.modal-cancel-btn') || e.target.matches('.modal')) {
            if (e.target.closest('.modal-content') && !e.target.matches('.modal-close-btn') && !e.target.matches('.modal-cancel-btn')) return;
            document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
        }
    });
}