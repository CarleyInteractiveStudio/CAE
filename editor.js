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

    // --- Modo de Animación ---
    const modeBtns = document.querySelectorAll('.mode-btn');
    const partsPanel = document.getElementById('parts-panel');
    const lassoToolBtn = document.querySelector('.tool-btn[data-tool="lasso"]');
    let animationMode = 'draw'; // 'draw', 'parts', or 'bone'

    function setAnimationMode(newMode) {
        animationMode = newMode;
        modeBtns.forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.mode === newMode);
        });

        // Mostrar u ocultar UI específica del modo
        const drawTools = document.querySelector('.tools');
        partsPanel.style.display = newMode === 'parts' ? 'block' : 'none';

        // Ocultar herramientas de dibujo y mostrar lazo, o viceversa
        drawTools.querySelectorAll('.tool-btn:not([data-tool="lasso"])').forEach(btn => {
            btn.style.display = newMode === 'draw' ? 'inline-block' : 'none';
        });
        lassoToolBtn.style.display = newMode === 'parts' ? 'inline-block' : 'none';

        // Si cambiamos a un modo que no es "parts", deseleccionamos el lazo
        if (newMode !== 'parts' && activeTool === 'lasso') {
            document.querySelector('.tool-btn[data-tool="brush"]').click();
        }
    }

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!btn.disabled) {
                setAnimationMode(btn.dataset.mode);
            }
        });
    });

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

    // --- Lienzo de Dibujo y Ayuda de Tamaño ---
    const canvas = document.getElementById('main-canvas');
    const ctx = canvas.getContext('2d');
    const guideCanvas = document.getElementById('guide-canvas');
    const guideCtx = guideCanvas.getContext('2d');
    const onionSkinCanvas = document.getElementById('onion-skin-canvas');
    const onionSkinCtx = onionSkinCanvas.getContext('2d');
    let isDrawing = false;
    let lassoPoints = [];

    // Controles de Efecto Cebolla
    const onionSkinGuideCheck = document.getElementById('onion-skin-guide');
    const onionSkinCopyCheck = document.getElementById('onion-skin-copy');

    // --- Panel de Partes ---
    const partsGrid = document.getElementById('parts-grid');
    const savePartBtn = document.getElementById('save-part-btn');
    let savedParts = [];

    let frameWidth = 600;
    let frameHeight = 600;

    // Elementos del Modal de Tamaño
    const setSizeBtn = document.getElementById('set-size-btn');
    const sizeModal = document.getElementById('size-modal');
    const saveSizeBtn = document.getElementById('save-size-btn');
    const cancelSizeBtn = document.getElementById('cancel-size-btn');
    const frameWidthInput = document.getElementById('frame-width');
    const frameHeightInput = document.getElementById('frame-height');

    function drawSizeGuide() {
        guideCtx.clearRect(0, 0, guideCanvas.width, guideCanvas.height);

        if (frameWidth === 600 && frameHeight === 600) {
            return; // No dibujar guía si es el tamaño completo
        }

        const canvasWidth = guideCanvas.width;
        const canvasHeight = guideCanvas.height;

        let guideW, guideH;
        const aspectRatio = frameWidth / frameHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        if (aspectRatio > canvasAspectRatio) {
            guideW = canvasWidth * 0.9;
            guideH = guideW / aspectRatio;
        } else {
            guideH = canvasHeight * 0.9;
            guideW = guideH * aspectRatio;
        }

        const guideX = (canvasWidth - guideW) / 2;
        const guideY = (canvasHeight - guideH) / 2;

        guideCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        guideCtx.setLineDash([5, 5]);
        guideCtx.lineWidth = 1;
        guideCtx.strokeRect(guideX, guideY, guideW, guideH);
        guideCtx.setLineDash([]);
    }

    setSizeBtn.addEventListener('click', () => {
        frameWidthInput.value = frameWidth;
        frameHeightInput.value = frameHeight;
        sizeModal.style.display = 'flex';
    });

    cancelSizeBtn.addEventListener('click', () => {
        sizeModal.style.display = 'none';
    });

    saveSizeBtn.addEventListener('click', () => {
        frameWidth = parseInt(frameWidthInput.value, 10) || 600;
        frameHeight = parseInt(frameHeightInput.value, 10) || 600;
        drawSizeGuide();
        sizeModal.style.display = 'none';
    });

    function resizeCanvas() {
        canvas.width = 600;
        canvas.height = 600;
        guideCanvas.width = 600;
        guideCanvas.height = 600;
        onionSkinCanvas.width = 600;
        onionSkinCanvas.height = 600;
        drawSizeGuide();
    }

    function startDrawing(e) {
        isDrawing = true;
        if (activeTool === 'lasso') {
            lassoPoints = [{ x: e.offsetX, y: e.offsetY }];
            guideCtx.clearRect(0, 0, guideCanvas.width, guideCanvas.height);
        } else {
            draw(e);
        }
    }

    function stopDrawing() {
        isDrawing = false;
        if (activeTool === 'lasso' && lassoPoints.length > 1) {
            // Cierra el lazo
            guideCtx.beginPath();
            guideCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
            lassoPoints.forEach(p => guideCtx.lineTo(p.x, p.y));
            guideCtx.closePath();
            guideCtx.strokeStyle = 'rgba(0, 122, 255, 0.8)';
            guideCtx.setLineDash([2, 2]);
            guideCtx.stroke();
            console.log("Lasso selection complete.", lassoPoints);
            // Pass the points to the save function, don't clear them here
        } else {
            ctx.beginPath();
        }
    }

    function draw(e) {
        if (!isDrawing) return;

        if (activeTool === 'lasso') {
            lassoPoints.push({ x: e.offsetX, y: e.offsetY });
            guideCtx.clearRect(0, 0, guideCanvas.width, guideCanvas.height);
            guideCtx.beginPath();
            guideCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
            lassoPoints.forEach(p => guideCtx.lineTo(p.x, p.y));
            guideCtx.strokeStyle = 'rgba(0, 122, 255, 0.8)';
            guideCtx.setLineDash([2, 2]);
            guideCtx.stroke();
            return;
        }

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

    // Drag and Drop de Partes
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const partDataURL = e.dataTransfer.getData('text/plain');
        if (partDataURL) {
            const img = new Image();
            img.onload = function() {
                ctx.drawImage(img, e.offsetX - img.width / 2, e.offsetY - img.height / 2);
            };
            img.src = partDataURL;
        }
    });

    resizeCanvas();

    // --- Lógica de Partes ---
    function renderSavedParts() {
        partsGrid.innerHTML = '';
        savedParts.forEach((partDataURL, index) => {
            const partPreview = document.createElement('div');
            partPreview.className = 'part-preview';
            partPreview.draggable = true;
            partPreview.dataset.partIndex = index;

            const img = document.createElement('img');
            img.src = partDataURL;
            partPreview.appendChild(img);

            partPreview.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', partDataURL);
            });

            partsGrid.appendChild(partPreview);
        });
    }

    function saveSelectedPart(points) {
        if (points.length < 3) return;

        // Crear un canvas temporal para la parte cortada
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // Encontrar los límites de la selección del lazo
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        const partWidth = maxX - minX;
        const partHeight = maxY - minY;

        if (partWidth <= 0 || partHeight <= 0) return;

        tempCanvas.width = partWidth;
        tempCanvas.height = partHeight;

        // Dibujar la selección en el canvas temporal
        tempCtx.beginPath();
        tempCtx.moveTo(points[0].x - minX, points[0].y - minY);
        points.forEach(p => tempCtx.lineTo(p.x - minX, p.y - minY));
        tempCtx.closePath();

        // Usar la selección como máscara de recorte
        tempCtx.clip();

        // Dibujar la imagen del lienzo principal en el lienzo temporal
        tempCtx.drawImage(canvas, -minX, -minY);

        // Guardar la parte
        savedParts.push(tempCanvas.toDataURL());
        renderSavedParts();

        // Opcional: Borrar la parte del lienzo principal
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fill();
        ctx.restore();

        // Limpiar selección del lazo
        lassoPoints = [];
        guideCtx.clearRect(0, 0, guideCanvas.width, guideCanvas.height);
    }

    savePartBtn.addEventListener('click', () => {
        if (lassoPoints.length > 2) {
            saveSelectedPart(lassoPoints);
        }
    });


    // --- Efecto Cebolla (Onion Skinning) ---
    function drawOnionSkin() {
        onionSkinCtx.clearRect(0, 0, onionSkinCanvas.width, onionSkinCanvas.height);

        if (!onionSkinGuideCheck.checked && !onionSkinCopyCheck.checked) {
            return; // No hacer nada si ambos están desactivados
        }

        if (currentFrame > 0) {
            const prevFrameData = frames[currentFrame - 1];
            const img = new Image();
            img.onload = function() {
                onionSkinCtx.globalAlpha = 0.4;
                onionSkinCtx.drawImage(img, 0, 0);
                onionSkinCtx.globalAlpha = 1.0;
            };
            img.src = prevFrameData;
        }
    }

    onionSkinGuideCheck.addEventListener('change', drawOnionSkin);
    onionSkinCopyCheck.addEventListener('change', drawOnionSkin);


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
        if (currentFrame < 0) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = frameWidth;
        tempCanvas.height = frameHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Calcular las dimensiones del área de recorte basado en la guía
        const guideW = canvas.width * 0.9;
        const guideH = guideW / (frameWidth / frameHeight);
        const guideX = (canvas.width - guideW) / 2;
        const guideY = (canvas.height - guideH) / 2;

        // Dibujar la sección del lienzo principal en el lienzo temporal, redimensionando
        tempCtx.drawImage(canvas, guideX, guideY, guideW, guideH, 0, 0, frameWidth, frameHeight);

        frames[currentFrame] = tempCanvas.toDataURL();
    }
    function selectFrame(index) {
        saveCurrentFrame();
        currentFrame = index;

        const img = new Image();
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            drawOnionSkin(); // Dibujar el efecto cebolla después de cargar el fotograma
        }
        img.src = frames[index];
        renderFrames();
    }

    function addNewFrame() {
        saveCurrentFrame();

        const prevFrameData = (currentFrame >= 0) ? frames[currentFrame] : null;

        if (onionSkinCopyCheck.checked && prevFrameData) {
            // Modo "Copiar y Borrar": El nuevo fotograma es una copia del anterior
            const img = new Image();
            img.onload = function() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                frames.push(canvas.toDataURL());
                currentFrame = frames.length - 1;
                renderFrames();
                drawOnionSkin();
            };
            img.src = prevFrameData;
        } else {
            // Modo normal o "Guía": El nuevo fotograma está en blanco
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL());
            currentFrame = frames.length - 1;
            renderFrames();
            drawOnionSkin();
        }
    }
    addFrameBtn.addEventListener('click', addNewFrame);

    toggleTimelineBtn.addEventListener('click', () => {
        const isHidden = timelinePanel.classList.toggle('hidden');
        toggleTimelineBtn.textContent = isHidden ? '▲' : '▼';
    });

    addNewFrame();
});
