document.addEventListener('DOMContentLoaded', () => {
    const createProjectBtn = document.getElementById('create-project-btn');
    const modal = document.getElementById('create-project-modal');
    const cancelBtn = document.getElementById('cancel-create-btn');
    const confirmBtn = document.getElementById('confirm-create-btn');
    const projectTypeOptions = document.querySelectorAll('.project-type-option');
    const projectNameInput = document.getElementById('project-name-input');
    const projectsGrid = document.getElementById('projects-grid');

    let selectedProjectType = null;
    let projectsDirHandle = null;

    // Función para listar y mostrar los proyectos
    async function loadProjects() {
        if (!projectsDirHandle) return;

        projectsGrid.innerHTML = ''; // Limpiar la grilla
        for await (const entry of projectsDirHandle.values()) {
            if (entry.kind === 'directory') {
                const projectCard = document.createElement('div');
                projectCard.className = 'project-card';

                const projectName = document.createElement('h3');
                projectName.textContent = entry.name;

                projectCard.appendChild(projectName);
                projectsGrid.appendChild(projectCard);
            }
        }
    }

    // Mostrar modal
    createProjectBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    // Ocultar modal
    function closeModal() {
        modal.style.display = 'none';
        projectTypeOptions.forEach(opt => opt.classList.remove('selected'));
        selectedProjectType = null;
        projectNameInput.value = '';
    }

    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Selección de tipo de proyecto
    projectTypeOptions.forEach(option => {
        option.addEventListener('click', () => {
            projectTypeOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedProjectType = option.dataset.type;
        });
    });

    // Lógica de creación de proyecto
    confirmBtn.addEventListener('click', async () => {
        const projectName = projectNameInput.value.trim();

        if (!selectedProjectType) {
            alert('Por favor, selecciona un tipo de proyecto.');
            return;
        }
        if (!projectName) {
            alert('Por favor, introduce un nombre para el proyecto.');
            return;
        }

        try {
            if (!projectsDirHandle) {
                projectsDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            }

            const projectDirHandle = await projectsDirHandle.getDirectoryHandle(projectName, { create: true });
            await projectDirHandle.getFileHandle(`${projectName}.ca`, { create: true });

            closeModal();
            loadProjects(); // Recargar la lista de proyectos
        } catch (error) {
            console.error('Error al crear el proyecto:', error);
            if (error.name !== 'AbortError') {
                alert('No se pudo crear el proyecto. Asegúrate de dar los permisos necesarios.');
            }
        }
    });

    // Intentar cargar proyectos al inicio si ya hay permisos
    async function init() {
        // Esta funcionalidad requiere un manejo de permisos más avanzado que se puede añadir en el futuro
    }

    init();
});
