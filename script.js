document.addEventListener('DOMContentLoaded', () => {
    // ... (elementos del DOM)
    const createProjectBtn = document.getElementById('create-project-btn');
    const modal = document.getElementById('create-project-modal');
    const cancelBtn = document.getElementById('cancel-create-btn');
    const confirmBtn = document.getElementById('confirm-create-btn');
    const projectTypeOptions = document.querySelectorAll('.project-type-option');
    const projectNameInput = document.getElementById('project-name-input');
    const projectsGrid = document.getElementById('projects-grid');

    let selectedProjectType = null;
    let projectsDirHandle = null;

    async function loadProjects() {
        if (!projectsDirHandle) return;

        // Verificar permisos
        if (await projectsDirHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
            console.log("Pidiendo permisos de nuevo...");
            if (await projectsDirHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
                alert("No se tienen permisos para leer la carpeta de proyectos.");
                return;
            }
        }

        projectsGrid.innerHTML = '';
        for await (const entry of projectsDirHandle.values()) {
            if (entry.kind === 'directory') {
                const projectCard = document.createElement('div');
                projectCard.className = 'project-card';
                const projectNameEl = document.createElement('h3');
                projectNameEl.textContent = entry.name;
                projectCard.appendChild(projectNameEl);
                projectCard.addEventListener('click', () => {
                    window.location.href = `editor.html?project=${encodeURIComponent(entry.name)}`;
                });
                projectsGrid.appendChild(projectCard);
            }
        }
    }

    // ... (lógica del modal)
    createProjectBtn.addEventListener('click', () => modal.style.display = 'flex');
    function closeModal() {
        modal.style.display = 'none';
        projectTypeOptions.forEach(opt => opt.classList.remove('selected'));
        selectedProjectType = null;
        projectNameInput.value = '';
    }
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    projectTypeOptions.forEach(option => {
        option.addEventListener('click', () => {
            projectTypeOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedProjectType = option.dataset.type;
        });
    });

    confirmBtn.addEventListener('click', async () => {
        const projectName = projectNameInput.value.trim();
        if (!selectedProjectType || !projectName) {
            alert('Por favor, completa todos los campos.');
            return;
        }

        try {
            if (!projectsDirHandle) {
                console.log("Pidiendo carpeta por primera vez.");
                projectsDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                await setDirectoryHandle(projectsDirHandle); // Guardar en IndexedDB
            }

            const projectDirHandle = await projectsDirHandle.getDirectoryHandle(projectName, { create: true });
            await projectDirHandle.getFileHandle(`${projectName}.ca`, { create: true });

            closeModal();
            loadProjects();
        } catch (error) {
            console.error('Error al crear el proyecto:', error);
            if (error.name !== 'AbortError') {
                alert('No se pudo crear el proyecto.');
            }
        }
    });

    async function init() {
        try {
            projectsDirHandle = await getDirectoryHandle();
            if (projectsDirHandle) {
                console.log("Carpeta de proyectos cargada desde IndexedDB.");
                loadProjects();
            } else {
                console.log("No se encontró una carpeta de proyectos guardada.");
            }
        } catch (error) {
            console.error("Error al inicializar:", error);
        }
    }

    init();
});
