"use strict";

// Parámetros de esta entrega. Unidades de escena; tiempos en segundos.
const CONFIG = {
    arena: 36,
    velocidad: 6,
    semianchoJugador: 0.65,
    inicio: { x: 0, z: 7 },
    tamanoCaja: 2.2,
    alturaApuntado: 1.2,
    CAMERA: {
        shoulderOffset: 0.45, // Deja libre la mira con un desplazamiento moderado.
        distance: 3.2,        // Vista estable detrás del personaje.
        height: 0.25,         // Altura sobre targetHeight; altura total inicial: 1.7.
        targetHeight: 1.45,
        minPitch: -30,        // Grados: mirar hacia abajo, sin vista cenital.
        maxPitch: 25,         // Grados: mirar hacia arriba.
        fov: 60,
        adsDistance: 2.25,
        adsShoulderOffset: 0.95,
        adsHeight: 0.38,
        adsFov: 45,
        adsSmoothness: 12,
        look: { forward: 4, lateral: 0, height: 0 }
    },
    WEAPON: {
        scale: 0.22, // Longitud del glTF 3.306: arma de aproximadamente 0.73 m.
        rotationOffset: { x: 0, y: 0, z: 0 }, // Radianes. El cañón real apunta a +Z; la culata, a -Z.
        // Unidades de escena, respecto a la mano en la orientación del arma.
        // Empuñadura local aprox. (0, -0.38, -0.75): elevar y adelantar el modelo
        // la acerca a la palma y deja la culata delante del pecho.
        positionOffset: { x: -0.03, y: 0.084, z: 0.22 },
        muzzleOffset: { x: 0, y: 0.1, z: 1.64 }, // Boca física del cañón, no la culata.
        idlePitch: 0.55, // Inclinación visual del cañón hacia abajo en reposo (radianes).
        recoil: 0.035 // Retroceso visual corto para que la culata no entre en el torso.
    },
    suavidadDistanciaCamara: 5,
    margenCamara: 0.3,
    sensibilidadRaton: 0.004,
    velocidadProyectil: 36,
    alcanceProyectil: 11,
    intervaloDisparo: 0.18,
    vidaProyectil: 1.5,
    radioProyectil: 0.12,
    gravedadProyectil: 2,
    velocidadVerticalInicial: 0,
    impulsoBote: 3.4,
    amortiguacionBote: 0.8,
    maxBotes: 0,
    gravedadFragmentos: 12,
    vidaFragmentos: 1.2,
    // [x, z, resistencia]; obstáculos: [x, z, ancho, fondo, alto, giro en radianes].
    // Giros de 0 o PI/2 conservan las colisiones AABB del proyecto.
    niveles: [
        { nombre: "Training Zone", tiempo: 25, acento: 0x35cfff,
            cajas: [[-10, -11, 1], [0, -12, 1], [10, -11, 1],
                [-9, -2, 1], [9, -2, 1], [-8, 10, 1], [8, 10, 1]],
            obstaculos: [] },
        { nombre: "Industrial Zone", tiempo: 35, acento: 0xffa544,
            cajas: [[-12, -12, 2], [-5, -13, 1], [5, -13, 2], [12, -12, 1],
                [-13, -3, 1], [-5, -3, 2], [5, -3, 1], [13, -3, 2],
                [-10, 11, 1], [10, 11, 2]],
            obstaculos: [[-10, 4, 3, 1.2, 2, 0], [10, 4, 3, 1.2, 2, 0],
                [0, 1, 3, 1.2, 2, 0]] },
        { nombre: "Danger Zone", tiempo: 40, acento: 0xff5365,
            cajas: [[-13, -13, 3], [-5, -13, 2], [5, -13, 3], [13, -13, 1],
                [-13, -4, 2], [-4, -4, 1], [4, -4, 3], [13, -4, 2],
                [-13, 11, 1], [-5, 12, 2], [5, 12, 1], [13, 11, 3]],
            obstaculos: [[-10, 3, 3, 1.2, 2, 0], [10, 3, 3, 1.2, 2, 0],
                [0, -8, 3, 1.2, 2, Math.PI / 2], [0, 2, 3, 1.2, 2, 0]] }
    ]
};

const IMPACTOS_POR_INDICADOR = 3;

let renderer, scene, camera, camaraTercera;
let jugador, modelo;
let mezcladorEly = null, animacionActual = null;
let elyVisual = null, manoDerecha = null, soporteArma = null, armaVisual = null, puntoBoca = null, destelloBoca = null;
let orientacionManoIdle = null;
let inclinacionArmaIdle = null;
let retrocesoArma = 0, tiempoBoca = 0;
const accionesEly = { idle: null, walk: null, run: null, shoot: null, dance: null };
const capasDisparoEly = [];
const velocidadClipEly = { walk: 0, run: 0 };
let siguienteCapaDisparo = 0;
let apuntandoADS = false, mezclaADS = 0, pausado = false, angulo = Math.PI;
let inclinacion = 0, distanciaCamaraActual = null;
let recuperandoCamara = false;
let estadoPartida = "inicio"; // inicio, cuenta, jugando, superado, victoria o derrota.
let cuentaRestante = 0, numeroCuentaVisible = "", tiempoYa = 0;
let indiceNivel = 0, puntuacion = 0, puntosNivel = 0;
let tiempoRestante = CONFIG.niveles[0].tiempo;
let disparoPendiente = false, esperaDisparo = 0, tiempoDestello = 0;
let geometriaFuego, materialNucleo, materialLlama, materialEstela, luzDisparo;
let geometriaFragmento, materialVida, materialVidaGastada;
const proyectiles = [];
const fragmentos = [];
const cajasIniciales = []; // Cajas de la distribución actual.
const volumenesCajas = [];
const volumenesObstaculos = [];
const mallasObstaculos = [];
const IMPACTO_OBSTACULO = Symbol("obstaculo fijo");
let recursosCajas, escenarioVisual;
const rayoProyectil = new THREE.Raycaster();
const puntoImpacto = new THREE.Vector3();
const siguienteProyectil = new THREE.Vector3();
const tramoProyectil = new THREE.Vector3();
const direccionApuntado = new THREE.Vector3();
const objetivoDisparo = new THREE.Vector3();
const impactoApuntado = new THREE.Vector3();
const rayoApuntado = new THREE.Ray();
const teclas = new Set();
const cajasActivas = [];
const obstaculos = []; // Límites XZ de cajas y barreras fijas; nunca adornos ni suelo.
const reloj = new THREE.Clock();
const direccion = new THREE.Vector3();
const derechaCamara = new THREE.Vector3();
const direccionRayoCamara = new THREE.Vector3();
const destinoCamara = new THREE.Vector3();
const origenCamara = new THREE.Vector3();
const desplazamientoCamara = new THREE.Vector3();
const impactoCamara = new THREE.Vector3();
const rayoCamara = new THREE.Ray();
const movimiento = new THREE.Vector3();
const codigosMovimiento = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];
const audioJuego = crearAudioJuego();

try {
    init();
    loadScene();
    volverAlInicio();
    render();
} catch (error) {
    document.getElementById("error").hidden = false;
    document.getElementById("mensaje-error").textContent = "Abre el proyecto mediante HTTP en un navegador con WebGL. " + error.message;
    console.error(error);
}

// S2: renderer + escena + cámaras + eventos.
function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = ESTADIO_VISUAL.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById("container").appendChild(renderer.domElement);
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("aria-label", "Arena 3D. WASD o flechas para moverse, clic derecho para apuntar, espacio para disparar.");
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101d2b);
    camaraTercera = new THREE.PerspectiveCamera(CONFIG.CAMERA.fov, 1, 0.08, 150);
    camera = camaraTercera;
    window.addEventListener("resize", updateAspectRatio);
    // También responde si la barra inferior cambia de altura al reorganizarse.
    new ResizeObserver(updateAspectRatio).observe(document.getElementById("container"));
    window.addEventListener("keydown", alPulsarTecla);
    window.addEventListener("keyup", event => teclas.delete(event.code));
    window.addEventListener("blur", () => {
        if (estadoPartida === "jugando" || estadoPartida === "cuenta") pausar();
        else audioJuego.pausar();
    });
    window.addEventListener("focus", () => {
        if (!document.hidden && estadoPartida !== "jugando" && estadoPartida !== "cuenta")
            audioJuego.reanudar();
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            if (estadoPartida === "jugando" || estadoPartida === "cuenta") pausar();
            else audioJuego.pausar();
        } else if (estadoPartida !== "jugando" && estadoPartida !== "cuenta") {
            audioJuego.reanudar();
        }
    });
    const canvas = renderer.domElement;
    canvas.addEventListener("contextmenu", event => event.preventDefault());
    canvas.addEventListener("pointerdown", event => {
        if (pausado || estadoPartida !== "jugando") return;
        if (event.button !== 0 && event.button !== 2) return;
        if (event.button === 2) {
            event.preventDefault();
            apuntandoADS = true;
            actualizarMira();
        }
        canvas.focus({ preventScroll: true });
        if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    });
    window.addEventListener("pointerup", event => {
        if (event.button === 2) desactivarADS();
    });
    window.addEventListener("pointercancel", desactivarADS);
    document.addEventListener("mousemove", alMoverRaton);
    document.addEventListener("pointerlockchange", () => {
        if (document.pointerLockElement !== canvas) desactivarADS();
    });
    document.getElementById("reanudar").addEventListener("click", reanudar);
    document.getElementById("comenzar").addEventListener("click", iniciarPartida);
    document.getElementById("siguiente-nivel").addEventListener("click", siguienteNivel);
    document.getElementById("reintentar-nivel").addEventListener("click", reintentarNivel);
    document.getElementById("volver-menu").addEventListener("click", volverAlInicio);
    document.getElementById("activar-audio").addEventListener("click", () => {
        if (audioJuego.silenciado) audioJuego.alternarSilencio();
        audioJuego.reanudar();
        audioJuego.desbloquear();
        actualizarControlesAudio();
    });
    for (const id of ["volumen-menu", "volumen-hud"]) {
        document.getElementById(id).addEventListener("input", event => {
            audioJuego.establecerVolumen(Number(event.target.value) / 100);
            audioJuego.desbloquear();
            actualizarControlesAudio();
        });
    }
    for (const id of ["silenciar-menu", "audio-hud"]) {
        document.getElementById(id).addEventListener("click", () => {
            audioJuego.alternarSilencio();
            actualizarControlesAudio();
        });
    }
    actualizarControlesAudio();
    updateAspectRatio();
}

function loadScene() {
    const cargador = new THREE.TextureLoader();
    const madera = cargador.load("images/wood512.jpg");
    const metal = cargador.load("images/pisometalico_1024.jpg");
    madera.encoding = metal.encoding = THREE.sRGBEncoding;
    metal.wrapS = metal.wrapT = THREE.RepeatWrapping;
    metal.repeat.set(1, 1);
    escenarioVisual = crearEscenarioVisual(scene, CONFIG.arena, metal);

    const geometriaCaja = new THREE.BoxGeometry(CONFIG.tamanoCaja, CONFIG.tamanoCaja, CONFIG.tamanoCaja);
    const materialCaja = new THREE.MeshLambertMaterial({ map: madera, color: 0xc99b5b });
    const materialMarco = new THREE.MeshLambertMaterial({ color: 0xa7773f });
    const metalCepillado = cargador.load("images/metal_128.jpg");
    const chapa = cargador.load("images/pisometalico_1024.jpg");
    metalCepillado.encoding = chapa.encoding = THREE.sRGBEncoding;
    // Texturas distintas para los tres niveles, sin alterar el repetido del suelo.
    const materialesCaja = [null, materialCaja,
        new THREE.MeshPhongMaterial({ map: metalCepillado, color: 0xc4d3d8, shininess: 65 }),
        new THREE.MeshPhongMaterial({ map: chapa, color: 0x527da3, shininess: 90 })];
    const marcos = [null, materialMarco,
        new THREE.MeshPhongMaterial({ color: 0x71818d, shininess: 60 }),
        new THREE.MeshPhongMaterial({ color: 0x253e56, shininess: 80 })];
    materialVida = new THREE.MeshBasicMaterial({ color: 0xffe7a0 });
    materialVidaGastada = new THREE.MeshBasicMaterial({ color: 0x24303a });
    const geometriaListon = new THREE.BoxGeometry(1, 1, 1);
    function crearCaja(x, z, resistencia = 1) {
        // Material por caja para que el destello de daño no afecte a sus vecinas.
        const caja = new THREE.Mesh(geometriaCaja, materialesCaja[resistencia].clone());
        caja.userData.resistencia = resistencia;
        caja.userData.vidaMaxima = resistencia * IMPACTOS_POR_INDICADOR;
        caja.userData.vida = caja.userData.vidaMaxima;
        caja.userData.destello = 0;
        caja.userData.marcasVida = [];
        caja.position.set(x, CONFIG.tamanoCaja / 2, z);
        caja.castShadow = caja.receiveShadow = true;
        // Listones sobre cada cara: geometría compartida y transformaciones locales (S2).
        const t = CONFIG.tamanoCaja;
        for (let cara = 0; cara < 5; cara++) {
            const marco = new THREE.Object3D();
            if (cara < 4) marco.rotation.y = cara * Math.PI / 2;
            else marco.rotation.x = -Math.PI / 2;
            for (const y of [-t / 2 + 0.09, t / 2 - 0.09]) {
                const liston = new THREE.Mesh(geometriaListon, marcos[resistencia]);
                liston.scale.set(t, 0.16, 0.055);
                liston.position.set(0, y, t / 2 + 0.012);
                marco.add(liston);
            }
            const diagonal = new THREE.Mesh(geometriaListon, marcos[resistencia]);
            diagonal.scale.set(t * 1.22, 0.13, 0.055);
            diagonal.rotation.z = Math.PI / 4;
            diagonal.position.z = t / 2 + 0.012;
            marco.add(diagonal);
            // Una marca por cada bloque de impactos, visible arriba y en los lados.
            for (let i = 0; i < resistencia; i++) {
                const marca = new THREE.Mesh(geometriaListon, materialVida);
                marca.scale.set(0.22, 0.16, 0.04);
                marca.position.set((i - (resistencia - 1) / 2) * 0.34, t * 0.3, t / 2 + 0.06);
                marco.add(marca);
                caja.userData.marcasVida.push({ mesh: marca, indice: i });
            }
            caja.add(marco);
        }
        scene.add(caja);
        cajasActivas.push(caja);
        const mitad = t / 2 + 0.05; // Incluye los listones visibles.
        obstaculos.push({ minX: x - mitad, maxX: x + mitad, minZ: z - mitad, maxZ: z + mitad });
        // Expandir el obstáculo permite barrer el centro de una bola con volumen.
        volumenesCajas.push(new THREE.Box3(
            new THREE.Vector3(x - mitad, 0, z - mitad),
            new THREE.Vector3(x + mitad, t, z + mitad)
        ).expandByScalar(CONFIG.radioProyectil));
        caja.userData.obstaculo = obstaculos[obstaculos.length - 1];
        caja.userData.volumen = volumenesCajas[volumenesCajas.length - 1];
        cajasIniciales.push(caja);
    }
    recursosCajas = { crearCaja };
    geometriaFragmento = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    crearPersonaje();
    // Recursos compartidos por todas las bolas: no se crean texturas ni shaders.
    geometriaFuego = new THREE.SphereGeometry(1, 16, 12);
    materialNucleo = new THREE.MeshBasicMaterial({ color: 0xe2ffff });
    materialLlama = new THREE.MeshBasicMaterial({
        color: 0x34d9ff, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    materialEstela = new THREE.MeshBasicMaterial({
        color: 0x448bff, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    luzDisparo = new THREE.PointLight(0x7cecff, 0, 5, 2);
    scene.add(luzDisparo);
}

function crearPersonaje() {
    jugador = new THREE.Object3D(); // Traslación sobre el suelo y giro Y.
    modelo = new THREE.Object3D(); // Se oculta todo el subárbol en primera persona.
    jugador.add(modelo);
    scene.add(jugador);
    const cargador = new THREE.FBXLoader();
    const ruta = "models/ely/";
    cargador.load(ruta + "Ely By K.Atienza.fbx", ely => {
        // El FBX está en centímetros (179 cm de altura). Solo este ejemplar se muestra.
        ely.scale.setScalar(0.011);
        ely.traverse(objeto => { if (objeto.isMesh) objeto.castShadow = true; });
        modelo.add(ely);
        elyVisual = ely;
        // Los pies de Idle y los apoyos de Walk/Run quedan junto al suelo con el origen en Y=0.
        manoDerecha = ely.getObjectByName("mixamorigRightHand");
        if (manoDerecha) cargarArma();
        else console.error("Ely no tiene el hueso mixamorigRightHand");
        mezcladorEly = new THREE.AnimationMixer(ely);
        const huesos = new Set();
        ely.traverse(objeto => { if (objeto.isBone) huesos.add(objeto.name); });
        const archivos = {
            idle: "Rifle Idle.fbx", walk: "Walk Forward.fbx",
            run: "Rifle Run.fbx", shoot: "Firing Rifle.fbx",
            dance: "House Dancing.fbx"
        };
        for (const [nombre, archivo] of Object.entries(archivos)) {
            cargador.load(ruta + archivo, copia => prepararClipEly(ely, huesos, nombre,
                archivo, copia.animations[0]), undefined,
            error => console.error("No se pudo cargar " + archivo, error));
        }
    }, undefined, error => console.error("No se pudo cargar Ely", error));
}

function prepararClipEly(ely, huesos, nombre, archivo, clip) {
    if (!clip || clip.tracks.some(pista => !huesos.has(pista.name.split(".")[0]))) {
        console.error("Esqueleto incompatible o animación ausente:", archivo);
        return;
    }
    const raiz = clip.tracks.find(pista => pista.name === "mixamorigHips.position");
    if (raiz && (nombre === "walk" || nombre === "run")) {
        const final = raiz.values.length - 3;
        velocidadClipEly[nombre] = Math.hypot(raiz.values[final] - raiz.values[0],
            raiz.values[final + 2] - raiz.values[2]) * ely.scale.x / clip.duration;
    }
    // Mixamo exportó Walk y Run con avance en la cadera: conservar Y
    // y fijar XZ al origen del modelo para que solo mueva la lógica del juego.
    for (const pista of clip.tracks) {
        if (pista.name === "mixamorigHips.position") {
            for (let i = 0; i < pista.values.length; i += 3) {
                pista.values[i] = 0;
                pista.values[i + 2] = 0;
            }
        }
    }
    if (nombre === "shoot") {
        crearCapasDisparoEly(ely, clip);
        return;
    }
    accionesEly[nombre] = mezcladorEly.clipAction(clip);
    if (nombre === "dance") {
        accionesEly.dance.setLoop(THREE.LoopRepeat, Infinity);
        if (estadoPartida === "victoria") activarBaileEly();
        return;
    }
    if (nombre === "idle" && !animacionActual) {
        animacionActual = accionesEly.idle;
        animacionActual.play();
        mezcladorEly.update(0);
    }
    if (nombre === "idle") {
        orientacionManoIdle = orientacionHuesoEnClip(manoDerecha, ely, clip);
        calibrarArma();
    }
}

function orientacionHuesoEnClip(hueso, raiz, clip) {
    // Muestra la orientación de la mano en el primer fotograma de Idle sin
    // tocar la pose actual del mixer ni depender del orden de carga del glTF.
    const cadena = [];
    for (let actual = hueso; actual && actual !== raiz; actual = actual.parent) cadena.unshift(actual);
    const resultado = new THREE.Quaternion();
    for (const nodo of cadena) {
        const pista = clip.tracks.find(t => t.name === nodo.name + ".quaternion");
        resultado.multiply(pista ? new THREE.Quaternion().fromArray(pista.values, 0) : nodo.quaternion);
    }
    return resultado;
}

function crearCapasDisparoEly(ely, clip) {
    const columnaSuperior = ely.getObjectByName("mixamorigSpine1");
    if (!columnaSuperior) {
        console.error("Ely no tiene el hueso mixamorigSpine1 para el disparo por capas");
        return;
    }
    const huesosSuperiores = new Set();
    columnaSuperior.traverse(objeto => { if (objeto.isBone) huesosSuperiores.add(objeto.name); });
    const pistas = clip.tracks.filter(pista => huesosSuperiores.has(pista.name.split(".")[0]));
    if (!pistas.length) return;
    // El primer fotograma es la postura armada de referencia. Solo añadimos el
    // cambio del disparo; la locomoción mantiene cadera, piernas y postura base.
    for (let i = 0; i < 2; i++) {
        const superior = new THREE.AnimationClip("ely-disparo-superior-" + i, clip.duration,
            pistas.map(pista => pista.clone()));
        THREE.AnimationUtils.makeClipAdditive(superior, 0);
        const accion = mezcladorEly.clipAction(superior);
        accion.setLoop(THREE.LoopOnce, 1);
        accion.clampWhenFinished = true;
        accion.setEffectiveTimeScale(3);
        capasDisparoEly.push({ accion, edad: Infinity, duracion: superior.duration / 3 });
    }
    accionesEly.shoot = capasDisparoEly[0].accion;
}

function cargarArma() {
    soporteArma = new THREE.Object3D();
    // Compensa los centímetros del FBX: los offsets del arma se expresan en unidades de escena.
    soporteArma.scale.setScalar(1 / elyVisual.scale.x);
    manoDerecha.add(soporteArma);
    new THREE.GLTFLoader().load("models/weapon/scene.gltf", gltf => {
        armaVisual = gltf.scene;
        // El nodo WEAPON trae del exportador una escala ~23 y una traslación
        // grande. La geometría ya está centrada en unidades útiles: quitar
        // esa transformación antes de sujetarla evita que aparezca lejos de Ely.
        const nodoExportador = armaVisual.getObjectByName("WEAPON");
        if (nodoExportador) {
            nodoExportador.position.set(0, 0, 0);
            nodoExportador.quaternion.identity();
            nodoExportador.scale.set(1, 1, 1);
        }
        armaVisual.scale.setScalar(CONFIG.WEAPON.scale);
        const p = CONFIG.WEAPON.positionOffset;
        armaVisual.position.set(p.x, p.y, p.z);
        armaVisual.traverse(objeto => { if (objeto.isMesh) objeto.castShadow = true; });
        soporteArma.add(armaVisual); // Una sola copia visible, unida a la mano.
        armaVisual.visible = false; // Espera la referencia de Idle antes de mostrarla.
        puntoBoca = new THREE.Object3D();
        const b = CONFIG.WEAPON.muzzleOffset;
        puntoBoca.position.set(b.x, b.y, b.z);
        armaVisual.add(puntoBoca);
        destelloBoca = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0x9cffff, transparent: true, opacity: 0.9,
                blending: THREE.AdditiveBlending, depthWrite: false }));
        destelloBoca.visible = false;
        puntoBoca.add(destelloBoca);
        calibrarArma();
    }, undefined, error => console.error("No se pudo cargar el arma", error));
}

function calibrarArma(delta = 0) {
    if (!soporteArma || !armaVisual || !manoDerecha) return;
    if (estadoPartida === "victoria") {
        armaVisual.visible = false;
        return;
    }
    // Esperar a Idle evita mostrar el arma durante la pose inicial de carga.
    if (!orientacionManoIdle) return;
    // Walk gira la muñeca de forma distinta a Rifle Idle. Compensar ese giro
    // cada fotograma mantiene el cañón hacia delante, conservando el anclaje
    // posicional en la mano y sin modificar ningún hueso ni animación.
    jugador.updateMatrixWorld(true);
    const giroMano = manoDerecha.getWorldQuaternion(new THREE.Quaternion());
    const giroJugador = jugador.getWorldQuaternion(new THREE.Quaternion());
    const r = CONFIG.WEAPON.rotationOffset;
    const enReposo = !apuntandoADS && (!accionesEly.idle || animacionActual === accionesEly.idle) &&
        !codigosMovimiento.some(codigo => teclas.has(codigo)) &&
        !teclas.has("Space") && !disparoPendiente && retrocesoArma < 0.001 &&
        capasDisparoEly.every(capa => capa.edad === Infinity);
    const objetivo = enReposo ? CONFIG.WEAPON.idlePitch : 0;
    if (inclinacionArmaIdle === null) inclinacionArmaIdle = objetivo;
    else inclinacionArmaIdle += (objetivo - inclinacionArmaIdle) * (1 - Math.exp(-10 * delta));
    soporteArma.quaternion.copy(giroMano).invert().multiply(giroJugador)
        .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(r.x, r.y, r.z, "XYZ")))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), inclinacionArmaIdle));
    armaVisual.visible = true;
}

function cambiarAnimacionEly(nombre, duracion = 0.2) {
    const siguiente = accionesEly[nombre];
    if (!siguiente || siguiente === animacionActual) return;
    siguiente.reset().play();
    if (animacionActual) siguiente.crossFadeFrom(animacionActual, duracion, false);
    animacionActual = siguiente;
}

function animarDisparoEly() {
    if (!capasDisparoEly.length) return;
    // Dos acciones permiten que un nuevo disparo entre mientras el anterior sale.
    const capa = capasDisparoEly[siguienteCapaDisparo];
    siguienteCapaDisparo = (siguienteCapaDisparo + 1) % capasDisparoEly.length;
    capa.edad = 0;
    capa.accion.reset().setEffectiveWeight(0).play();
}

function actualizarAnimacionesEly(delta, distancia) {
    if (!mezcladorEly) return;
    const velocidadReal = delta > 0 ? distancia / delta : 0;
    cambiarAnimacionEly(velocidadReal > 0.01 ? "walk" : "idle", 0.22);
    if (accionesEly.walk && velocidadClipEly.walk > 0) {
        // El ciclo de Mixamo recorre ~2 m/s; el jugador avanza a 6 m/s.
        accionesEly.walk.setEffectiveTimeScale(Math.max(0.7,
            Math.min(1.4, velocidadReal / velocidadClipEly.walk)));
    }
    for (const capa of capasDisparoEly) {
        if (capa.edad === Infinity) continue;
        capa.edad += delta;
        if (capa.edad >= capa.duracion) {
            capa.accion.stop();
            capa.edad = Infinity;
            continue;
        }
        const entrada = Math.min(1, capa.edad / 0.045);
        const salida = Math.min(1, (capa.duracion - capa.edad) / 0.14);
        capa.accion.setEffectiveWeight(0.65 * Math.min(entrada, salida));
    }
    mezcladorEly.update(delta);
}

function activarBaileEly() {
    if (!mezcladorEly || !accionesEly.dance) return;
    mezcladorEly.stopAllAction();
    for (const capa of capasDisparoEly) capa.edad = Infinity;
    animacionActual = accionesEly.dance;
    animacionActual.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    mezcladorEly.update(0);
}

function actualizarControlesAudio() {
    const porcentaje = Math.round(audioJuego.volumen * 100);
    for (const id of ["volumen-menu", "volumen-hud"])
        document.getElementById(id).value = String(porcentaje);
    document.getElementById("valor-volumen").textContent = `${porcentaje}%`;
    const silencio = audioJuego.silenciado || porcentaje === 0;
    for (const id of ["silenciar-menu", "audio-hud"]) {
        const boton = document.getElementById(id);
        boton.textContent = silencio ? "♪̸" : "♪";
        boton.setAttribute("aria-label", silencio ? "Activar sonido" : "Silenciar sonido");
        boton.title = silencio ? "Activar sonido" : "Silenciar sonido";
    }
    document.getElementById("activar-audio").textContent = audioJuego.desbloqueado
        ? (silencio ? "MÚSICA SILENCIADA" : "MÚSICA ACTIVADA") : "ACTIVAR MÚSICA";
}

function alPulsarTecla(event) {
    if (event.code === "Space") {
        // Espacio sobre un botón debe activarlo, no lanzar una bola al escenario.
        if (event.target?.closest?.("button, input, textarea, select, [contenteditable]")) return;
        event.preventDefault();
        if (estadoPartida === "jugando" && !pausado && !event.repeat) {
            disparoPendiente = true; // Conserva incluso una pulsación entre fotogramas.
            teclas.add("Space");
        }
        return;
    }
    if (codigosMovimiento.includes(event.code)) {
        event.preventDefault();
        if (!pausado && estadoPartida === "jugando") teclas.add(event.code);
    }
}

function alMoverRaton(event) {
    if (pausado || estadoPartida !== "jugando" || document.pointerLockElement !== renderer.domElement) return;
    angulo -= event.movementX * CONFIG.sensibilidadRaton;
    inclinacion = THREE.MathUtils.clamp(inclinacion - event.movementY * CONFIG.sensibilidadRaton,
        THREE.MathUtils.degToRad(CONFIG.CAMERA.minPitch), THREE.MathUtils.degToRad(CONFIG.CAMERA.maxPitch));
}

function actualizarMira() {
    document.getElementById("mira").hidden = !apuntandoADS || pausado || estadoPartida !== "jugando";
}

function desactivarADS() {
    apuntandoADS = false;
    actualizarMira();
}

// AABB en XZ: el jugador ocupa un cuadrado, no un punto ni un único rayo.
function posicionLibre(x, z) {
    const r = CONFIG.semianchoJugador;
    const limite = CONFIG.arena / 2 - r;
    if (Math.abs(x) > limite || Math.abs(z) > limite) return false;
    return !obstaculos.some(o => x + r > o.minX && x - r < o.maxX && z + r > o.minZ && z - r < o.maxZ);
}

function moverConColisiones(dx, dz) {
    // Pasos cortos impiden atravesar cajas con un desplazamiento grande.
    const pasos = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (CONFIG.semianchoJugador * 0.5)));
    const limite = CONFIG.arena / 2 - CONFIG.semianchoJugador;
    for (let i = 0; i < pasos; i++) {
        const x = THREE.MathUtils.clamp(jugador.position.x + dx / pasos, -limite, limite);
        if (posicionLibre(x, jugador.position.z)) jugador.position.x = x;
        const z = THREE.MathUtils.clamp(jugador.position.z + dz / pasos, -limite, limite);
        if (posicionLibre(jugador.position.x, z)) jugador.position.z = z;
    }
}

function segmentoTocaCaja(origen, frente, distancia) {
    // Barrido del segmento: una bola rápida no salta cajas ni barreras.
    rayoProyectil.set(origen, frente);
    rayoProyectil.near = 0;
    rayoProyectil.far = distancia;
    let cajaCercana = null;
    let distanciaCercana = rayoProyectil.far;
    for (let i = 0; i < volumenesCajas.length; i++) {
        const volumen = volumenesCajas[i];
        if (volumen.containsPoint(origen)) return cajasActivas[i];
        const impacto = rayoProyectil.ray.intersectBox(volumen, puntoImpacto);
        // intersectBox usa el rayo geométrico: aplicamos far explícitamente.
        const distanciaImpacto = impacto ? origen.distanceTo(impacto) : Infinity;
        if (distanciaImpacto <= distanciaCercana) {
            cajaCercana = cajasActivas[i];
            distanciaCercana = distanciaImpacto;
        }
    }
    for (const volumen of volumenesObstaculos) {
        if (volumen.containsPoint(origen)) return IMPACTO_OBSTACULO;
        const impacto = rayoProyectil.ray.intersectBox(volumen, puntoImpacto);
        const distanciaImpacto = impacto ? origen.distanceTo(impacto) : Infinity;
        if (distanciaImpacto <= distanciaCercana) {
            cajaCercana = IMPACTO_OBSTACULO;
            distanciaCercana = distanciaImpacto;
        }
    }
    return cajaCercana; // El primer volumen alcanzado, aunque las listas cambien de orden.
}

function actualizarContador() {
    document.getElementById("contador-cajas").textContent = cajasActivas.length
        ? `${cajasActivas.length} / ${cajasIniciales.length} CAJAS` : "ARENA DESPEJADA";
}

function actualizarPuntuacion() {
    document.getElementById("puntuacion").textContent = String(puntuacion + puntosNivel);
}

function golpearCaja(caja) {
    if (estadoPartida !== "jugando" || pausado || !cajasActivas.includes(caja)) return;
    caja.userData.vida--;
    const indicadoresRestantes = Math.ceil(caja.userData.vida / IMPACTOS_POR_INDICADOR);
    for (const marca of caja.userData.marcasVida) {
        marca.mesh.material = marca.indice < indicadoresRestantes ? materialVida : materialVidaGastada;
        marca.mesh.visible = marca.indice < indicadoresRestantes;
    }
    if (caja.userData.vida === 0) destruirCaja(caja);
    else {
        caja.userData.destello = 0.12;
        caja.material.emissive.setHex(0xff6020);
    }
}

function actualizarCajas(delta) {
    for (const caja of cajasActivas) {
        caja.userData.destello = Math.max(0, caja.userData.destello - delta);
        if (caja.userData.destello === 0) caja.material.emissive.setHex(0x000000);
    }
}

function destruirCaja(caja) {
    if (estadoPartida !== "jugando" || pausado) return;
    const indice = cajasActivas.indexOf(caja);
    if (indice === -1) return; // Dos impactos nunca destruyen la misma caja dos veces.
    audioJuego.efecto("break");
    caja.material.emissive.setHex(0x000000);
    scene.remove(caja);
    cajasActivas.splice(indice, 1);
    obstaculos.splice(indice, 1);
    volumenesCajas.splice(indice, 1);
    puntosNivel += caja.userData.resistencia * 100;
    actualizarPuntuacion();
    actualizarContador(); // El paso queda libre en el mismo fotograma.
    for (let i = 0; i < 8; i++) {
        const giro = i * Math.PI / 4;
        const objeto = new THREE.Mesh(geometriaFragmento, caja.material);
        objeto.position.copy(caja.position);
        objeto.position.x += Math.cos(giro) * 0.5;
        objeto.position.z += Math.sin(giro) * 0.5;
        objeto.castShadow = true;
        scene.add(objeto);
        fragmentos.push({ objeto, edad: 0,
            velocidad: new THREE.Vector3(Math.cos(giro) * 3, 3 + (i % 3), Math.sin(giro) * 3),
            giro: new THREE.Vector3(2 + i, 3, i % 2 ? 4 : -4)
        });
    }
    luzDisparo.position.copy(caja.position);
    tiempoDestello = 0.09;
    luzDisparo.intensity = 2;
}

function actualizarFragmentos(delta) {
    for (let i = fragmentos.length - 1; i >= 0; i--) {
        const f = fragmentos[i];
        f.edad += delta;
        if (f.edad >= CONFIG.vidaFragmentos) {
            scene.remove(f.objeto);
            fragmentos.splice(i, 1);
            continue;
        }
        // Movimiento balístico sencillo: posición += v·dt + ½g·dt².
        f.objeto.position.addScaledVector(f.velocidad, delta);
        f.objeto.position.y -= 0.5 * CONFIG.gravedadFragmentos * delta * delta;
        f.velocidad.y -= CONFIG.gravedadFragmentos * delta;
        if (f.objeto.position.y < 0.15) {
            f.objeto.position.y = 0.15;
            f.velocidad.y = Math.abs(f.velocidad.y) * 0.25;
            f.velocidad.x *= 0.6;
            f.velocidad.z *= 0.6;
        }
        f.objeto.rotation.x += f.giro.x * delta;
        f.objeto.rotation.y += f.giro.y * delta;
        f.objeto.rotation.z += f.giro.z * delta;
        f.objeto.scale.setScalar(Math.min(1, (CONFIG.vidaFragmentos - f.edad) / 0.3));
    }
}

function limpiarNivel() {
    for (const caja of cajasIniciales) {
        scene.remove(caja);
        caja.material.dispose(); // Solo el material clonado; geometrías y texturas son compartidas.
    }
    cajasIniciales.length = cajasActivas.length = volumenesCajas.length = 0;
    for (const malla of mallasObstaculos) scene.remove(malla);
    mallasObstaculos.length = volumenesObstaculos.length = obstaculos.length = 0;
    limpiarEfectosTemporales();
}

function limpiarEfectosTemporales() {
    for (const f of fragmentos) scene.remove(f.objeto);
    fragmentos.length = 0;
    for (const proyectil of proyectiles) scene.remove(proyectil.objeto);
    proyectiles.length = 0;
    tiempoDestello = tiempoBoca = 0;
    if (destelloBoca) destelloBoca.visible = false;
    if (luzDisparo) luzDisparo.intensity = 0;
}

function crearObstaculo([x, z, ancho, fondo, alto, giro = 0]) {
    const grupo = escenarioVisual.crearBarricada(ancho, fondo, alto);
    grupo.position.set(x, 0, z);
    grupo.rotation.y = giro;
    scene.add(grupo);
    mallasObstaculos.push(grupo);
    // Los giros configurados son múltiplos de 90 grados: el AABB es exacto.
    const girado = Math.abs(Math.sin(giro)) > 0.5;
    const mitadX = (girado ? fondo : ancho) / 2;
    const mitadZ = (girado ? ancho : fondo) / 2;
    obstaculos.push({ minX: x - mitadX, maxX: x + mitadX,
        minZ: z - mitadZ, maxZ: z + mitadZ });
    volumenesObstaculos.push(new THREE.Box3(
        new THREE.Vector3(x - mitadX, 0, z - mitadZ),
        new THREE.Vector3(x + mitadX, alto, z + mitadZ)
    ).expandByScalar(CONFIG.radioProyectil));
}

function cargarNivel(indice) {
    limpiarNivel();
    indiceNivel = indice;
    const nivel = CONFIG.niveles[indiceNivel];
    for (const caja of nivel.cajas) recursosCajas.crearCaja(...caja);
    for (const obstaculo of nivel.obstaculos) crearObstaculo(obstaculo);
    escenarioVisual.cambiarNivel(indiceNivel, nivel);
    tiempoRestante = nivel.tiempo;
    puntosNivel = 0;
    actualizarPuntuacion();
    document.getElementById("nivel-actual").textContent = `${indiceNivel + 1}/${CONFIG.niveles.length}`;
    document.getElementById("nombre-nivel").textContent = nivel.nombre;
    actualizarContador();
    actualizarTiempo();
    esperaDisparo = tiempoDestello = 0;
    retrocesoArma = tiempoBoca = 0;
    inclinacionArmaIdle = null;
    if (armaVisual) armaVisual.position.z = CONFIG.WEAPON.positionOffset.z;
    if (destelloBoca) destelloBoca.visible = false;
    luzDisparo.intensity = 0;
    jugador.position.set(CONFIG.inicio.x, 0, CONFIG.inicio.z);
    modelo.rotation.y = 0;
    angulo = Math.PI;
    inclinacion = 0;
    distanciaCamaraActual = null;
    recuperandoCamara = false;
    mezclaADS = 0;
    if (mezcladorEly) {
        mezcladorEly.stopAllAction();
        for (const capa of capasDisparoEly) capa.edad = Infinity;
        siguienteCapaDisparo = 0;
        animacionActual = accionesEly.idle;
        if (animacionActual) animacionActual.reset().play();
        mezcladorEly.update(0);
    }
    actualizarCamaras(0, true);
    jugador.rotation.y = angulo;
    calibrarArma();
}

function origenDisparo() {
    if (puntoBoca) {
        jugador.updateMatrixWorld(true);
        return puntoBoca.getWorldPosition(new THREE.Vector3());
    }
    // Permite seguir jugando mientras se descargan el FBX y el glTF.
    return new THREE.Vector3(jugador.position.x, CONFIG.alturaApuntado, jugador.position.z);
}

function direccionDesdeBoca(origen) {
    // La mira define un rayo desde la cámara. Si apunta a una caja, el cañón converge
    // sobre el primer impacto; si no, converge a un punto lejano del mismo rayo.
    direccionApuntado.set(Math.sin(angulo) * Math.cos(inclinacion), Math.sin(inclinacion),
        Math.cos(angulo) * Math.cos(inclinacion));
    rayoApuntado.set(camera.position, direccionApuntado);
    let distanciaObjetivo = Math.max(30, CONFIG.alcanceProyectil * 2);
    for (const caja of [...volumenesCajas, ...volumenesObstaculos]) {
        if (rayoApuntado.intersectBox(caja, impactoApuntado)) {
            distanciaObjetivo = Math.min(distanciaObjetivo, camera.position.distanceTo(impactoApuntado));
        }
    }
    objetivoDisparo.copy(camera.position).addScaledVector(direccionApuntado, distanciaObjetivo);
    const salida = objetivoDisparo.clone().sub(origen).normalize();
    return salida.dot(direccionApuntado) > 0 ? salida : direccionApuntado.clone();
}

function disparar() {
    if (estadoPartida !== "jugando" || pausado || esperaDisparo > 0.000001) return;
    esperaDisparo = CONFIG.intervaloDisparo;
    audioJuego.efecto("shoot");
    const origen = origenDisparo();
    const salida = direccionDesdeBoca(origen);
    const frente = new THREE.Vector3(salida.x, 0, salida.z).normalize();
    animarDisparoEly();
    retrocesoArma = CONFIG.WEAPON.recoil;
    tiempoBoca = 0.075;
    if (destelloBoca) destelloBoca.visible = true;
    luzDisparo.position.copy(origen);
    tiempoDestello = 0.09;
    luzDisparo.intensity = 2;
    // Si el cañón roza una caja, el impacto se resuelve en este fotograma.
    const cajaEnSalida = segmentoTocaCaja(origen, salida, CONFIG.radioProyectil);
    if (cajaEnSalida) {
        if (cajaEnSalida !== IMPACTO_OBSTACULO) golpearCaja(cajaEnSalida);
        return;
    }
    const bola = new THREE.Object3D();
    bola.position.copy(origen);
    bola.lookAt(bola.position.clone().add(salida));
    const nucleo = new THREE.Mesh(geometriaFuego, materialNucleo);
    nucleo.scale.set(CONFIG.radioProyectil * 0.65, CONFIG.radioProyectil * 0.65, CONFIG.radioProyectil * 2.1);
    bola.add(nucleo);
    const llama = new THREE.Mesh(geometriaFuego, materialLlama);
    llama.scale.set(CONFIG.radioProyectil * 1.3, CONFIG.radioProyectil * 1.3, CONFIG.radioProyectil * 2.8);
    bola.add(llama);
    for (let i = 1; i <= 3; i++) {
        const cola = new THREE.Mesh(geometriaFuego, materialEstela);
        cola.scale.setScalar(CONFIG.radioProyectil * (1 - i * 0.2));
        cola.position.z = -i * CONFIG.radioProyectil * 1.1;
        bola.add(cola);
    }
    scene.add(bola);
    proyectiles.push({ objeto: bola, llama, direccion: frente, edad: 0,
        velocidadY: CONFIG.velocidadVerticalInicial + salida.y * CONFIG.velocidadProyectil,
        velocidadHorizontal: Math.hypot(salida.x, salida.z) * CONFIG.velocidadProyectil, botes: 0,
        distanciaRecorrida: 0 });
}

// Devuelve false cuando la bola debe retirarse. La dirección XZ nunca cambia.
function avanzarProyectil(proyectil, delta) {
    const posicion = proyectil.objeto.position;
    let pendiente = Math.min(delta, Math.max(0, CONFIG.vidaProyectil - proyectil.edad));
    while (pendiente > 0.00000001) {
        const g = CONFIG.gravedadProyectil;
        const altura = Math.max(0, posicion.y - CONFIG.radioProyectil);
        const vy = proyectil.velocidadY;
        // Raíz positiva de altura + vy*t - g*t²/2 = 0: instante de contacto.
        const hastaSuelo = (vy + Math.sqrt(vy * vy + 2 * g * altura)) / g;
        const hastaLimite = Math.max(0, CONFIG.alcanceProyectil - proyectil.distanciaRecorrida) / proyectil.velocidadHorizontal;
        const paso = Math.min(pendiente, 1 / 120, hastaSuelo, hastaLimite);
        siguienteProyectil.copy(posicion).addScaledVector(proyectil.direccion, proyectil.velocidadHorizontal * paso);
        siguienteProyectil.y += vy * paso - 0.5 * g * paso * paso;
        tramoProyectil.subVectors(siguienteProyectil, posicion);
        const distancia = tramoProyectil.length();
        // Barrido 3D por tramos cortos: respeta la curva y ambos lados del rebote.
        const impacto = distancia > 0 ? segmentoTocaCaja(posicion, tramoProyectil.normalize(), distancia) : null;
        if (impacto) {
            if (impacto !== IMPACTO_OBSTACULO) golpearCaja(impacto);
            return false; // Un proyectil produce un solo impacto, también en cajas duras.
        }
        posicion.copy(siguienteProyectil);
        proyectil.velocidadY -= g * paso;
        proyectil.edad += paso;
        proyectil.distanciaRecorrida += proyectil.velocidadHorizontal * paso;
        pendiente -= paso;
        if (proyectil.distanciaRecorrida >= CONFIG.alcanceProyectil - 0.00000001) return false;
        if (hastaSuelo <= paso + 0.00000001) {
            posicion.y = CONFIG.radioProyectil;
            // Tras tres rebotes completos, se apaga al volver a tocar el suelo.
            if (proyectil.botes >= CONFIG.maxBotes) return false;
            proyectil.velocidadY = CONFIG.impulsoBote * Math.pow(CONFIG.amortiguacionBote, proyectil.botes);
            proyectil.botes++;
        }
        if (Math.abs(posicion.x) > CONFIG.arena / 2 || Math.abs(posicion.z) > CONFIG.arena / 2) return false;
    }
    // La estela sigue la tangente de la trayectoria en lugar de quedar horizontal.
    siguienteProyectil.copy(posicion).add(proyectil.direccion);
    siguienteProyectil.y += proyectil.velocidadY / proyectil.velocidadHorizontal;
    proyectil.objeto.lookAt(siguienteProyectil);
    return proyectil.edad < CONFIG.vidaProyectil - 0.00000001;
}

function actualizarProyectiles(delta) {
    tiempoDestello = Math.max(0, tiempoDestello - delta);
    luzDisparo.intensity = 2 * tiempoDestello / 0.09;
    for (let i = proyectiles.length - 1; i >= 0; i--) {
        const proyectil = proyectiles[i];
        if (!avanzarProyectil(proyectil, delta)) {
            scene.remove(proyectil.objeto);
            proyectiles.splice(i, 1);
            // Geometría y materiales son compartidos: no hacer dispose aquí.
        } else {
            const brillo = 1.3 + 0.12 * Math.sin(proyectil.edad * 70);
            proyectil.llama.scale.set(CONFIG.radioProyectil * brillo,
                CONFIG.radioProyectil * brillo, CONFIG.radioProyectil * 2.8);
        }
    }
}

function actualizarArma(delta) {
    calibrarArma(delta);
    retrocesoArma *= Math.exp(-18 * delta);
    if (armaVisual) armaVisual.position.z = CONFIG.WEAPON.positionOffset.z - retrocesoArma;
    tiempoBoca = Math.max(0, tiempoBoca - delta);
    if (destelloBoca) destelloBoca.visible = tiempoBoca > 0;
}

function update(delta, tiempoTranscurrido = delta) {
    if (pausado) return;
    if (estadoPartida === "cuenta") {
        actualizarCuentaAtras(tiempoTranscurrido);
        return;
    }
    if (estadoPartida === "victoria") {
        if (mezcladorEly && accionesEly.dance) mezcladorEly.update(delta);
        return;
    }
    if (estadoPartida !== "jugando") return;
    if (tiempoYa > 0) {
        tiempoYa = Math.max(0, tiempoYa - tiempoTranscurrido);
        if (tiempoYa === 0) document.getElementById("cuenta-atras").hidden = true;
    }
    // Solo se simula hasta el límite del tiempo disponible en el último fotograma.
    delta = Math.min(delta, tiempoRestante);
    const pulsada = (a, b) => Number(teclas.has(a) || teclas.has(b));
    const lateral = pulsada("KeyD", "ArrowRight") - pulsada("KeyA", "ArrowLeft");
    const avance = pulsada("KeyW", "ArrowUp") - pulsada("KeyS", "ArrowDown");
    // Frente = (sen θ, 0, cos θ); el pitch no altera el movimiento sobre XZ.
    movimiento.set(avance * Math.sin(angulo) - lateral * Math.cos(angulo), 0,
        avance * Math.cos(angulo) + lateral * Math.sin(angulo));
    movimiento.normalize().multiplyScalar(CONFIG.velocidad * delta);
    const anteriorX = jugador.position.x, anteriorZ = jugador.position.z;
    moverConColisiones(movimiento.x, movimiento.z);
    const distancia = Math.hypot(jugador.position.x - anteriorX, jugador.position.z - anteriorZ);
    actualizarAnimacionesEly(delta, distancia);
    actualizarCamaras(delta);
    jugador.rotation.y = angulo;
    actualizarCajas(delta);
    actualizarFragmentos(delta);
    actualizarArma(delta);
    actualizarProyectiles(delta);
    escenarioVisual.actualizar(delta);
    esperaDisparo = Math.max(0, esperaDisparo - delta);
    if (disparoPendiente || teclas.has("Space")) disparar();
    disparoPendiente = false;
    // El reloj usa tiempo real, aunque limitemos delta para estabilizar el movimiento.
    tiempoRestante = Math.max(0, tiempoRestante - tiempoTranscurrido);
    actualizarTiempo();
    if (cajasActivas.length === 0) terminarPartida(true);
    else if (tiempoRestante <= 0.000001) terminarPartida(false);
}

function actualizarTiempo() {
    const etiqueta = document.getElementById("tiempo");
    etiqueta.textContent = `${tiempoRestante.toFixed(1)} s`;
    const urgente = tiempoRestante <= 10;
    etiqueta.closest(".reloj").classList.toggle("urgente", urgente);
    etiqueta.style.color = urgente ?
        `hsl(${Math.round(8 + tiempoRestante * 3)} 95% 69%)` : "";
}

function iniciarPartida() {
    if (estadoPartida === "victoria") {
        estadoPartida = "inicio";
        puntuacion = 0;
        cargarNivel(0);
    }
    if (estadoPartida !== "inicio") return;
    audioJuego.reanudar();
    comenzarCuentaAtras();
    audioJuego.desbloquear(); // El botón es un gesto válido para el navegador.
}

function comenzarCuentaAtras() {
    estadoPartida = "cuenta";
    pausado = false;
    limpiarEntrada();
    audioJuego.detenerEfectos();
    audioJuego.musica(null);
    cuentaRestante = 3;
    numeroCuentaVisible = "3";
    tiempoYa = 0;
    document.getElementById("numero-cuenta").textContent = "3";
    document.getElementById("cuenta-atras").hidden = false;
    document.getElementById("partida").hidden = true;
    actualizarMira();
    reloj.getDelta();
    renderer.domElement.focus({ preventScroll: true });
}

function actualizarCuentaAtras(deltaReal) {
    cuentaRestante = Math.max(0, cuentaRestante - deltaReal);
    if (cuentaRestante > 0) {
        const numero = String(Math.ceil(cuentaRestante));
        if (numero !== numeroCuentaVisible) {
            numeroCuentaVisible = numero;
            document.getElementById("numero-cuenta").textContent = numero;
        }
        return;
    }
    estadoPartida = "jugando";
    numeroCuentaVisible = "¡YA!";
    document.getElementById("numero-cuenta").textContent = "¡YA!";
    tiempoYa = 0.6;
    audioJuego.musica("game");
    actualizarMira();
    reloj.getDelta();
}

function terminarPartida(victoria) {
    if (estadoPartida !== "jugando") return;
    const nivel = CONFIG.niveles[indiceNivel];
    const ultimo = indiceNivel === CONFIG.niveles.length - 1;
    estadoPartida = victoria ? (ultimo ? "victoria" : "superado") : "derrota";
    limpiarEntrada();
    document.getElementById("mira").hidden = true;
    document.getElementById("cuenta-atras").hidden = true;
    const titulo = document.getElementById("titulo-partida");
    const detalle = document.getElementById("detalle-partida");
    const panel = document.getElementById("partida");
    panel.classList.remove("menu-principal", "resultado", "victoria-final");
    panel.classList.add(ultimo && victoria ? "victoria-final" : "resultado");
    document.getElementById("info-menu").hidden = true;
    document.getElementById("leyenda-cajas").hidden = true;
    document.getElementById("datos-resultado").hidden = false;
    document.getElementById("subtitulo-partida").textContent =
        ultimo && victoria ? "FUTURISTIC COMBAT TRAINING / 3 DE 3" :
        victoria ? `NIVEL ${indiceNivel + 1} SUPERADO` : "RESULTADO DEL INTENTO";
    const comenzar = document.getElementById("comenzar");
    const siguiente = document.getElementById("siguiente-nivel");
    const reintentar = document.getElementById("reintentar-nivel");
    const menu = document.getElementById("volver-menu");
    comenzar.hidden = siguiente.hidden = reintentar.hidden = menu.hidden = true;
    if (victoria) {
        const bonus = Math.floor(tiempoRestante) * 20;
        puntosNivel += bonus;
        actualizarPuntuacion();
        document.getElementById("etiqueta-dato-1").textContent = "TIEMPO RESTANTE";
        document.getElementById("dato-1").textContent = `${tiempoRestante.toFixed(1)} s`;
        document.getElementById("etiqueta-dato-2").textContent = "PUNTOS DEL NIVEL";
        document.getElementById("dato-2").textContent = String(puntosNivel);
        document.getElementById("etiqueta-dato-3").textContent = "PUNTUACIÓN TOTAL";
        document.getElementById("dato-3").textContent = String(puntuacion + puntosNivel);
        titulo.textContent = ultimo ? "¡ARENA COMPLETADA!" : "Nivel superado";
        detalle.textContent = ultimo
            ? `Has superado los tres niveles de entrenamiento. Niveles completados: 3/3. Bonus de tiempo: ${bonus} puntos.`
            : `${nivel.nombre} completado. Bonus de tiempo: ${bonus} puntos.`;
        audioJuego.detenerEfecto("shoot");
        if (ultimo) {
            limpiarEfectosTemporales();
            if (armaVisual) armaVisual.visible = false;
            // Girar solo la representación: la cámara y la orientación física siguen intactas.
            modelo.rotation.y = Math.PI;
            activarBaileEly();
            audioJuego.musica("victory");
            comenzar.hidden = menu.hidden = false;
            comenzar.textContent = "VOLVER A JUGAR";
        } else {
            audioJuego.musica(null);
            audioJuego.efecto("levelComplete");
            siguiente.hidden = false;
        }
    } else {
        audioJuego.musica(null);
        audioJuego.efecto("gameOver");
        titulo.textContent = "Tiempo agotado";
        detalle.textContent = `${nivel.nombre} · ${cajasIniciales.length - cajasActivas.length} ` +
            `de ${cajasIniciales.length} cajas destruidas. Este intento: ${puntosNivel} puntos. ` +
            `Puntos conservados de niveles anteriores: ${puntuacion}.`;
        document.getElementById("etiqueta-dato-1").textContent = "CAJAS DESTRUIDAS";
        document.getElementById("dato-1").textContent =
            `${cajasIniciales.length - cajasActivas.length}/${cajasIniciales.length}`;
        document.getElementById("etiqueta-dato-2").textContent = "ESTE INTENTO";
        document.getElementById("dato-2").textContent = String(puntosNivel);
        document.getElementById("etiqueta-dato-3").textContent = "PUNTOS CONSERVADOS";
        document.getElementById("dato-3").textContent = String(puntuacion);
        reintentar.hidden = menu.hidden = false;
    }
    panel.hidden = false;
    (ultimo && victoria ? comenzar : victoria ? siguiente : reintentar).focus();
}

function siguienteNivel() {
    if (estadoPartida !== "superado") return;
    puntuacion += puntosNivel;
    limpiarEntrada();
    cargarNivel(indiceNivel + 1);
    comenzarCuentaAtras();
}

function reintentarNivel() {
    if (estadoPartida !== "derrota") return;
    limpiarEntrada();
    cargarNivel(indiceNivel);
    comenzarCuentaAtras();
}

function actualizarCamaras(delta, inmediata = false) {
    // El punto de seguimiento usa la posición actual: no retrasa el ratón ni
    // compite con la corrección de distancia ante cajas.
    const ajuste = CONFIG.CAMERA;
    const objetivoADS = apuntandoADS ? 1 : 0;
    mezclaADS = inmediata ? objetivoADS : mezclaADS + (objetivoADS - mezclaADS) *
        (1 - Math.exp(-ajuste.adsSmoothness * delta));
    const fov = THREE.MathUtils.lerp(ajuste.fov, ajuste.adsFov, mezclaADS);
    if (Math.abs(camaraTercera.fov - fov) > 0.0001) {
        camaraTercera.fov = fov;
        camaraTercera.updateProjectionMatrix();
    }
    direccion.set(Math.sin(angulo) * Math.cos(inclinacion), Math.sin(inclinacion), Math.cos(angulo) * Math.cos(inclinacion));
    derechaCamara.set(-Math.cos(angulo), 0, Math.sin(angulo));
    origenCamara.copy(jugador.position);
    origenCamara.y += ajuste.targetHeight;
    desplazamientoCamara.copy(direccion).multiplyScalar(-THREE.MathUtils.lerp(ajuste.distance, ajuste.adsDistance, mezclaADS));
    desplazamientoCamara.y += THREE.MathUtils.lerp(ajuste.height, ajuste.adsHeight, mezclaADS);
    desplazamientoCamara.addScaledVector(derechaCamara,
        THREE.MathUtils.lerp(ajuste.shoulderOffset, ajuste.adsShoulderOffset, mezclaADS));
    const longitud = desplazamientoCamara.length();
    rayoCamara.set(origenCamara, direccionRayoCamara.copy(desplazamientoCamara).normalize());
    let distanciaLibre = longitud;
    // Los volúmenes existentes desaparecen con sus cajas; el personaje no bloquea su propia cámara.
    for (const caja of [...volumenesCajas, ...volumenesObstaculos]) {
        if (rayoCamara.intersectBox(caja, impactoCamara)) {
            distanciaLibre = Math.min(distanciaLibre, origenCamara.distanceTo(impactoCamara) - CONFIG.margenCamara);
        }
    }
    const borde = CONFIG.arena / 2 - CONFIG.margenCamara;
    for (const eje of ["x", "z"]) {
        const paso = desplazamientoCamara[eje];
        if (paso > 0 && origenCamara[eje] + paso > borde) {
            distanciaLibre = Math.min(distanciaLibre, (borde - origenCamara[eje]) / paso * longitud);
        } else if (paso < 0 && origenCamara[eje] + paso < -borde) {
            distanciaLibre = Math.min(distanciaLibre, (-borde - origenCamara[eje]) / paso * longitud);
        }
    }
    if (origenCamara.y + desplazamientoCamara.y < 0.45) {
        distanciaLibre = Math.min(distanciaLibre, (0.45 - origenCamara.y) / desplazamientoCamara.y * longitud);
    }
    distanciaLibre = Math.max(0.15, distanciaLibre);
    const obstruida = distanciaLibre < longitud - 0.0001;
    if (inmediata || distanciaCamaraActual === null) {
        distanciaCamaraActual = distanciaLibre;
        recuperandoCamara = obstruida;
    } else if (obstruida && distanciaLibre < distanciaCamaraActual) {
        distanciaCamaraActual = distanciaLibre;
        recuperandoCamara = true;
    } else if (recuperandoCamara && distanciaCamaraActual < distanciaLibre) {
        distanciaCamaraActual += (distanciaLibre - distanciaCamaraActual) *
            (1 - Math.exp(-CONFIG.suavidadDistanciaCamara * delta));
        if (distanciaLibre - distanciaCamaraActual < 0.01) recuperandoCamara = false;
    } else {
        distanciaCamaraActual = distanciaLibre;
        recuperandoCamara = obstruida;
    }
    camaraTercera.position.copy(rayoCamara.direction).multiplyScalar(distanciaCamaraActual).add(origenCamara);
    destinoCamara.copy(camaraTercera.position)
        .addScaledVector(direccion, ajuste.look.forward)
        .addScaledVector(derechaCamara, ajuste.look.lateral);
    destinoCamara.y += ajuste.look.height;
    camaraTercera.lookAt(destinoCamara);
}

function limpiarEntrada() {
    teclas.clear();
    disparoPendiente = false;
    desactivarADS();
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
}

function pausar() {
    if (estadoPartida !== "jugando" && estadoPartida !== "cuenta") return;
    limpiarEntrada();
    pausado = true;
    audioJuego.pausar();
    document.getElementById("mira").hidden = true;
    document.getElementById("titulo-pausa").textContent = estadoPartida === "cuenta"
        ? "Cuenta atrás en pausa" : "Seguimos cuando quieras.";
    document.getElementById("pausa").hidden = false;
}

function reanudar() {
    if (estadoPartida !== "jugando" && estadoPartida !== "cuenta") return;
    limpiarEntrada();
    pausado = false;
    audioJuego.reanudar();
    audioJuego.desbloquear(); // El botón permite reactivar audio bloqueado al volver a la pestaña.
    actualizarMira();
    reloj.getDelta(); // Descarta el tiempo que la pestaña pasó suspendida.
    document.getElementById("pausa").hidden = true;
    renderer.domElement.focus({ preventScroll: true });
}

function volverAlInicio() {
    estadoPartida = "inicio";
    pausado = false;
    cuentaRestante = tiempoYa = 0;
    limpiarEntrada();
    audioJuego.detenerEfectos();
    audioJuego.reanudar();
    audioJuego.musica("menu");
    puntuacion = 0;
    cargarNivel(0);
    document.getElementById("mira").hidden = true;
    document.getElementById("cuenta-atras").hidden = true;
    document.getElementById("pausa").hidden = true;
    const panel = document.getElementById("partida");
    panel.classList.remove("resultado", "victoria-final");
    panel.classList.add("menu-principal");
    document.getElementById("subtitulo-partida").textContent = "FUTURISTIC COMBAT TRAINING";
    document.getElementById("titulo-partida").textContent = "ARENA BLASTER";
    document.getElementById("detalle-partida").textContent =
        "Tres zonas de combate. Destruye todos los objetivos antes de que termine el tiempo.";
    document.getElementById("info-menu").hidden = false;
    document.getElementById("leyenda-cajas").hidden = false;
    document.getElementById("datos-resultado").hidden = true;
    document.getElementById("comenzar").textContent = "EMPEZAR A JUGAR";
    document.getElementById("comenzar").hidden = false;
    document.getElementById("siguiente-nivel").hidden = true;
    document.getElementById("reintentar-nivel").hidden = true;
    document.getElementById("volver-menu").hidden = true;
    panel.hidden = false;
    actualizarTiempo();
    actualizarControlesAudio();
    reloj.getDelta();
    document.getElementById("comenzar").focus();
}

function updateAspectRatio() {
    // El canvas ocupa todo el espacio restante bajo el HUD superior.
    const contenedor = document.getElementById("container");
    const ancho = Math.max(1, contenedor.clientWidth), alto = Math.max(1, contenedor.clientHeight);
    renderer.setSize(ancho, alto);
    camaraTercera.aspect = ancho / alto;
    camaraTercera.updateProjectionMatrix();
}

function render() {
    requestAnimationFrame(render);
    // Tope defensivo frente a un bloqueo de la pestaña; subpasos para las colisiones.
    const delta = reloj.getDelta();
    audioJuego.actualizar(delta);
    update(Math.min(delta, 0.05), delta);
    escenarioVisual.renderizar(renderer, scene, camera);
}
