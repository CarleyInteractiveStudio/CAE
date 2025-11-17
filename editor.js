// Creative Animation - Editor Script
document.addEventListener('DOMContentLoaded', async () => {
    // --- Configuración Inicial y Carga de Proyecto ---
    let configHandle = null;
    let savedColors = [];
    const urlParams = new URLSearchParams(window.location.search);
    const projectName = urlParams.get('project');
    if (!projectName) {
        alert("No se ha especificado un proyecto.");
        window.location.href = 'index.html';
        return;
    }
    document.title = `${projectName} - Creative Animation`;

    async function loadProject() {
        try {
            const rootDirHandle = await getDirectoryHandle(); // Usar IndexedDB
            if (!rootDirHandle) {
                // alert("No se encontró la carpeta de proyectos. Por favor, crea un proyecto primero.");
                // window.location.href = 'index.html';
                console.log("Modo de prueba: No se encontró el handle, continuando sin cargar proyecto.");
                return;
            }
            if (await rootDirHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
                if (await rootDirHandle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
                    alert("No se tienen permisos para acceder a la carpeta del proyecto.");
                    window.location.href = 'index.html';
                    return;
                }
            }
            const projectDirHandle = await rootDirHandle.getDirectoryHandle(projectName, { create: false });
            configHandle = await projectDirHandle.getFileHandle(`${projectName}.cac`, { create: true });
            const file = await configHandle.getFile();
            const content = await file.text();
            if (content) {
                const config = JSON.parse(content);
                savedColors = config.savedColors || [];
            }
        } catch (error) {
            console.error("Error cargando el proyecto:", error);
            alert("No se pudo cargar el proyecto.");
            window.location.href = 'index.html';
        }
    }

    async function saveConfig() {
        if (!configHandle) return;
        try {
            const writable = await configHandle.createWritable();
            const config = { savedColors };
            await writable.write(JSON.stringify(config, null, 2));
            await writable.close();
        } catch (error) {
            console.error("Error al guardar la configuración:", error);
        }
    }

    await loadProject();

    // --- Panel de Herramientas ---
    const toolBtns = document.querySelectorAll('.tool-btn');
    const colorPicker = document.getElementById('color-picker');
    const brushSizeSlider = document.getElementById('brush-size');
    const brushOpacitySlider = document.getElementById('brush-opacity');
    const brushSizeValue = document.getElementById('brush-size-value');
    const brushOpacityValue = document.getElementById('brush-opacity-value');
    const saveColorBtn = document.getElementById('save-color-btn');
    const savedColorsGrid = document.getElementById('saved-colors-grid');

    let activeTool = 'brush';
    let brushSize = 2;
    let brushOpacity = 1.0;

    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toolBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            activeTool = btn.dataset.tool;
        });
    });

    brushSizeSlider.addEventListener('input', (e) => {
        brushSize = e.target.value;
        brushSizeValue.textContent = brushSize;
    });

    brushOpacitySlider.addEventListener('input', (e) => {
        brushOpacity = e.target.value;
        brushOpacityValue.textContent = brushOpacity;
    });

    function renderSavedColors() {
        savedColorsGrid.innerHTML = '';
        savedColors.forEach(color => {
            const colorCircle = document.createElement('div');
            colorCircle.style.backgroundColor = color;
            colorCircle.className = 'saved-color';
            colorCircle.addEventListener('click', () => { colorPicker.value = color; });
            savedColorsGrid.appendChild(colorCircle);
        });
    }
    saveColorBtn.addEventListener('click', () => {
        const currentColor = colorPicker.value;
        if (!savedColors.includes(currentColor)) {
            savedColors.push(currentColor);
            renderSavedColors();
            saveConfig();
        }
    });
    renderSavedColors();

    // --- Lienzo de Dibujo ---
    const canvas = document.getElementById('main-canvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;

    function resizeCanvas() {
        canvas.width = 700;
        canvas.height = 700;
    }

    function startDrawing(e) {
        isDrawing = true;
        draw(e);
    }

    function stopDrawing() {
        isDrawing = false;
        ctx.beginPath();
    }

    function draw(e) {
        if (!isDrawing) return;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.globalAlpha = brushOpacity;
        if (activeTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = colorPicker.value;
            if (activeTool === 'marker') {
                 ctx.globalAlpha = 0.3;
            } else if (activeTool === 'pencil') {
                ctx.lineWidth = 1;
            }
        }
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.offsetX, e.offsetY);
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('mousemove', draw);

    resizeCanvas();

    // --- Línea de Tiempo ---
    const timelinePanel = document.querySelector('.timeline-panel');
    const toggleTimelineBtn = document.getElementById('toggle-timeline-btn');
    const addFrameBtn = document.getElementById('add-frame-btn');
    const framesStrip = document.querySelector('.frames-strip');
    let frames = [];
    let currentFrame = -1;
    function renderFrames() {
        framesStrip.innerHTML = '';
        frames.forEach((frameData, index) => {
            const framePreview = document.createElement('div');
            framePreview.className = 'frame-preview';
            if (index === currentFrame) framePreview.classList.add('selected');
            const img = document.createElement('img');
            img.src = frameData;
            framePreview.appendChild(img);
            framePreview.addEventListener('click', () => selectFrame(index));
            framesStrip.appendChild(framePreview);
        });
    }
    function saveCurrentFrame() {
        if (currentFrame >= 0) frames[currentFrame] = canvas.toDataURL();
    }
    function selectFrame(index) {
        saveCurrentFrame();
        currentFrame = index;
        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        }
        img.src = frames[index];
        renderFrames();
    }
    function addNewFrame() {
        saveCurrentFrame();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL());
        currentFrame = frames.length - 1;
        renderFrames();
    }
    addFrameBtn.addEventListener('click', addNewFrame);

    toggleTimelineBtn.addEventListener('click', () => {
        const isHidden = timelinePanel.classList.toggle('hidden');
        toggleTimelineBtn.textContent = isHidden ? '▲' : '▼';
    });

    addNewFrame();
});
