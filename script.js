// Importa o serviço do Firestore da nossa nova configuração
import { db } from './firebase-config.js';
import { collection, getDocs, doc, getDoc, query, where, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- LÓGICA PRINCIPAL DO SITE ---
document.addEventListener('DOMContentLoaded', () => {
    // --- CARREGAMENTO INICIAL DOS DADOS DINÂMICOS ---
    loadInstitutionalContent();
    loadDocuments();
    loadProjects();

    // --- LÓGICA DO MENU RESPONSIVO E NAVEGAÇÃO SPA ---
    const menuToggle = document.getElementById('menu-toggle');
    const overlay = document.getElementById('overlay');
    const navLinks = document.querySelectorAll('.main-nav a');
    const closeMenu = () => document.body.classList.remove('sidebar-open');
    menuToggle.addEventListener('click', (e) => { e.stopPropagation(); document.body.classList.toggle('sidebar-open'); });
    overlay.addEventListener('click', closeMenu);
    navLinks.forEach(link => link.addEventListener('click', closeMenu));

    const navItems = document.querySelectorAll('.main-nav li');
    const pages = document.querySelectorAll('.page');
    function showPage(hash) {
        pages.forEach(page => page.classList.toggle('active', '#' + page.id === hash));
        navItems.forEach(item => {
            const link = item.querySelector('a');
            if (link) { item.classList.toggle('active', link.hash === hash); }
        });
        window.scrollTo(0, 0);
    }
    function handleHashChange() {
        const hash = window.location.hash || '#home';
        showPage(hash);
    }
    window.addEventListener('hashchange', handleHashChange);
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const hash = this.getAttribute('href');
            if (window.location.hash !== hash) { window.location.hash = hash; }
        });
    });
    handleHashChange();

    // --- ANIMAÇÃO AO ROLAR ---
    const animatedElements = document.querySelectorAll('.animated-element');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); } });
    }, { threshold: 0.1 });
    animatedElements.forEach(el => observer.observe(el));
});

// --- FUNÇÕES DE BUSCA DE DADOS DO FIRESTORE ---

// Carrega os textos da seção Institucional
async function loadInstitutionalContent() {
    try {
        const docRef = doc(db, 'conteudo', 'institucional');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Converte quebras de linha (\n) em tags <br> para exibição no HTML
            document.getElementById('inst-missao-content').innerHTML = data.missao.replace(/\n/g, '<br>');
            document.getElementById('inst-visao-content').innerHTML = data.visao.replace(/\n/g, '<br>');
            document.getElementById('inst-diretoria-content').innerHTML = data.diretoria.replace(/\n/g, '<br>');
        }
    } catch (error) { console.error("Erro ao carregar conteúdo institucional:", error); }
}

// Carrega todos os documentos e os distribui nas listas corretas
async function loadDocuments() {
    try {
        const querySnapshot = await getDocs(collection(db, "documentos"));
        const docLists = {
            institucional: '',
            transparencia: '',
            prestacao: ''
        };

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const listItem = `<li><a href="${data.fileURL}" target="_blank">${data.title} <i class="fas fa-download"></i></a></li>`;
            if (data.category === 'Institucional') docLists.institucional += listItem;
            if (data.category === 'Transparência') docLists.transparencia += listItem;
            if (data.category === 'Prestação de Contas') docLists.prestacao += listItem;
        });

        document.getElementById('documentos-institucional-list').innerHTML = docLists.institucional || '<li>Nenhum documento encontrado.</li>';
        document.getElementById('documentos-transparencia-list').innerHTML = docLists.transparencia || '<li>Nenhum documento encontrado.</li>';
        document.getElementById('documentos-prestacao-list').innerHTML = docLists.prestacao || '<li>Nenhum documento encontrado.</li>';

    } catch (error) { console.error("Erro ao carregar documentos:", error); }
}

// Carrega os projetos e os exibe em cards
async function loadProjects() {
    try {
        const container = document.getElementById('projetos-container');
        const querySnapshot = await getDocs(collection(db, "projetos"));
        
        if (querySnapshot.empty) {
            container.innerHTML = '<p>Nenhum projeto encontrado no momento.</p>';
            return;
        }

        let html = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            html += `
                <div class="card animated-element">
                    <div class="card-body">
                        <h4>${data.title} <span class="status-badge ${data.status.replace(/\s+/g, '-').toLowerCase()}">${data.status}</span></h4>
                        <p>${data.description.replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        // Re-observa os novos elementos para animação
        document.querySelectorAll('#projetos-container .animated-element').forEach(el => new IntersectionObserver((entries) => {
            entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); } });
        }, { threshold: 0.1 }).observe(el));

    } catch (error) { console.error("Erro ao carregar projetos:", error); }
}


// --- FUNCIONALIDADE DE COPIAR CHAVE PIX (sem alterações) ---
window.copyPixKey = function(pixKey) {
    navigator.clipboard.writeText(pixKey).then(() => alert('Chave PIX copiada!'));
}

// --- FUNCIONALIDADE DO FORMULÁRIO DE CONTATO (ATUALIZADO PARA FIRESTORE) ---
const contactForm = document.getElementById('contactForm');
const formFeedback = document.getElementById('form-feedback');

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = contactForm.querySelector('#name').value;
        const email = contactForm.querySelector('#email').value;
        const message = contactForm.querySelector('#message').value;

        try {
            await addDoc(collection(db, "contatos"), {
                nome: name,
                email: email,
                mensagem: message,
                data: Timestamp.now()
            });
            formFeedback.textContent = 'Mensagem enviada com sucesso!';
            formFeedback.style.color = 'green';
            contactForm.reset();
        } catch (error) {
            formFeedback.textContent = 'Ocorreu um erro ao enviar. Tente novamente.';
            formFeedback.style.color = 'red';
            console.error('Erro ao salvar no Firebase: ', error);
        }
    });
}