import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- CONFIGURAÇÃO E ELEMENTOS GLOBAIS ---
const UPLOADCARE_PUBLIC_KEY = "SUA_CHAVE_PUBLICA_DO_UPLOADCARE"; // COLE SUA CHAVE AQUI
let uploadedFileInfo = null;

const loader = document.getElementById('loader');
const adminEmailSpan = document.getElementById('admin-email');
const logoutBtn = document.getElementById('logout-btn');
const pageTitle = document.getElementById('page-title');
const adminNav = document.getElementById('admin-nav');
const contentSections = document.querySelectorAll('.content-section');

// --- AUTENTICAÇÃO E NAVEGAÇÃO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        adminEmailSpan.textContent = `Bem-vindo, ${user.email}`;
        loader.style.display = 'none';
        setupNavigation();
        handleRouteChange(); // Carrega a seção correta
    } else {
        window.location.href = 'index.html';
    }
});

logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'index.html'));

function handleRouteChange() {
    const hash = window.location.hash || '#dashboard';
    const targetId = hash.substring(1);
    
    contentSections.forEach(section => section.classList.remove('active'));
    document.getElementById(`${targetId}-content`).classList.add('active');

    adminNav.querySelectorAll('li').forEach(li => li.classList.remove('active'));
    adminNav.querySelector(`li[data-target="${targetId}"]`).classList.add('active');
    
    pageTitle.textContent = targetId.charAt(0).toUpperCase() + targetId.slice(1);

    // Carrega os dados da seção ativa
    switch(targetId) {
        case 'dashboard':
            updateDashboardStats();
            break;
        case 'documentos':
            fetchAndRenderDocuments();
            break;
        case 'projetos':
            fetchAndRenderProjects();
            break;
    }
}

function setupNavigation() {
    window.addEventListener('hashchange', handleRouteChange);
}

// --- DASHBOARD ---
const docCountEl = document.getElementById('doc-count');
const projectCountEl = document.getElementById('project-count');

async function updateDashboardStats() {
    const docSnapshot = await getDocs(collection(db, "documentos"));
    const projectQuery = query(collection(db, "projetos"), where("status", "==", "Em Execução"));
    const projectSnapshot = await getDocs(projectQuery);
    
    docCountEl.textContent = docSnapshot.size;
    projectCountEl.textContent = projectSnapshot.size;
}

// --- GERENCIAR DOCUMENTOS ---
const addDocumentForm = document.getElementById('add-document-form');
const documentsTableBody = document.getElementById('documentos-table-body');
const uploadDocBtn = document.getElementById('upload-doc-btn');
const docFileInfoDiv = document.getElementById('doc-file-info');

uploadDocBtn.addEventListener('click', () => {
    const dialog = uploadcare.openDialog(null, { publicKey: UPLOADCARE_PUBLIC_KEY, tabs: 'file url', locale: 'pt' });
    dialog.done(file => file.done(info => {
        uploadedFileInfo = info;
        docFileInfoDiv.textContent = `Arquivo: ${info.name}`;
        docFileInfoDiv.classList.add('success');
    }));
});

addDocumentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = addDocumentForm['doc-title'].value;
    const category = addDocumentForm['doc-category'].value;
    if (!uploadedFileInfo) { alert("Escolha um arquivo."); return; }
    loader.style.display = 'flex';
    try {
        await addDoc(collection(db, "documentos"), { title, category, fileURL: uploadedFileInfo.cdnUrl, fileUUID: uploadedFileInfo.uuid, createdAt: new Date() });
        addDocumentForm.reset();
        docFileInfoDiv.textContent = 'Nenhum arquivo selecionado.';
        uploadedFileInfo = null;
        fetchAndRenderDocuments();
    } catch (error) { console.error("Erro:", error); alert("Erro ao salvar."); } 
    finally { loader.style.display = 'none'; }
});

const fetchAndRenderDocuments = async () => {
    documentsTableBody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    const querySnapshot = await getDocs(collection(db, "documentos"));
    documentsTableBody.innerHTML = querySnapshot.empty ? '<tr><td colspan="3">Nenhum documento.</td></tr>' : '';
    querySnapshot.forEach(doc => {
        const data = doc.data();
        documentsTableBody.innerHTML += `<tr><td><a href="${data.fileURL}" target="_blank">${data.title}</a></td><td>${data.category}</td><td class="actions"><button class="btn-icon btn-danger delete-btn" data-type="documento" data-id="${doc.id}"><i class="fas fa-trash"></i></button></td></tr>`;
    });
};

// --- GERENCIAR PROJETOS ---
const addProjectForm = document.getElementById('add-project-form');
const projectsTableBody = document.getElementById('projetos-table-body');

addProjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = addProjectForm['project-title'].value;
    const description = addProjectForm['project-desc'].value;
    const status = addProjectForm['project-status'].value;
    loader.style.display = 'flex';
    try {
        await addDoc(collection(db, "projetos"), { title, description, status, createdAt: new Date() });
        addProjectForm.reset();
        fetchAndRenderProjects();
    } catch (error) { console.error("Erro:", error); alert("Erro ao salvar."); }
    finally { loader.style.display = 'none'; }
});

const fetchAndRenderProjects = async () => {
    projectsTableBody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    const querySnapshot = await getDocs(collection(db, "projetos"));
    projectsTableBody.innerHTML = querySnapshot.empty ? '<tr><td colspan="3">Nenhum projeto.</td></tr>' : '';
    querySnapshot.forEach(doc => {
        const data = doc.data();
        projectsTableBody.innerHTML += `<tr><td>${data.title}</td><td>${data.status}</td><td class="actions"><button class="btn-icon btn-danger delete-btn" data-type="projeto" data-id="${doc.id}"><i class="fas fa-trash"></i></button></td></tr>`;
    });
};

// --- LÓGICA DE EXCLUSÃO GENÉRICA ---
document.body.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const docId = deleteBtn.dataset.id;
        const type = deleteBtn.dataset.type;
        const collectionName = type === 'documento' ? 'documentos' : 'projetos';
        
        if (confirm(`Tem certeza que deseja excluir este ${type}?`)) {
            loader.style.display = 'flex';
            try {
                await deleteDoc(doc(db, collectionName, docId));
                alert(`${type.charAt(0).toUpperCase() + type.slice(1)} excluído com sucesso!`);
                if (type === 'documento') fetchAndRenderDocuments();
                if (type === 'projeto') fetchAndRenderProjects();
            } catch (error) { alert("Erro ao excluir."); } 
            finally { loader.style.display = 'none'; }
        }
    }
});