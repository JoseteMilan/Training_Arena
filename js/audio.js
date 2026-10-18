"use strict";

// Un único gestor reutiliza las pistas y limita las voces simultáneas.
const AUDIO_AJUSTES = {
    volumenInicial: 0.30,
    desvanecimiento: 0.35,
    musica: { menu: 0.65, game: 0.48, victory: 0.7 },
    efectos: { shoot: 0.38, break: 0.55, levelComplete: 0.7,
        gameOver: 0.7 }
};

function crearAudioJuego() {
    const archivos = {
        menu: "sounds/menu.mp3", game: "sounds/music.mp3",
        victory: "sounds/victory.mp3", shoot: "sounds/shoot.mp3",
        break: "sounds/break.mp3", levelComplete: "sounds/level_complete.mp3",
        gameOver: "sounds/game_over.mp3"
    };
    const pistas = {};
    for (const nombre of ["menu", "game", "victory"]) {
        const pista = new Audio(archivos[nombre]);
        pista.loop = true;
        pista.preload = "auto";
        pistas[nombre] = pista;
    }
    const voces = {};
    for (const [nombre, cantidad] of Object.entries({ shoot: 4, break: 2,
        levelComplete: 1, gameOver: 1 })) {
        voces[nombre] = Array.from({ length: cantidad }, () => {
            const voz = new Audio(archivos[nombre]);
            voz.preload = "auto";
            return voz;
        });
    }

    let volumen = AUDIO_AJUSTES.volumenInicial;
    let silenciado = false;
    try {
        const guardado = Number(localStorage.getItem("arenaBlaster.volumen"));
        if (localStorage.getItem("arenaBlaster.volumen") !== null &&
            Number.isFinite(guardado)) volumen = THREE.MathUtils.clamp(guardado, 0, 1);
        silenciado = localStorage.getItem("arenaBlaster.silenciado") === "true";
    } catch (_) { /* La partida funciona aunque el almacenamiento esté bloqueado. */ }

    let desbloqueado = false;
    let pausado = false;
    let deseada = null;
    let activa = null;
    let mezcla = 0;

    function guardar() {
        try {
            localStorage.setItem("arenaBlaster.volumen", String(volumen));
            localStorage.setItem("arenaBlaster.silenciado", String(silenciado));
        } catch (_) { /* Preferencia solo durante esta sesión. */ }
    }

    function reproducir(pista) {
        const intento = pista.play();
        if (intento && typeof intento.catch === "function") intento.catch(() => {
            desbloqueado = false; // Esperar otra interacción, nunca reintentar por fotograma.
            if (activa && pistas[activa] === pista) {
                pista.pause();
                activa = null;
                mezcla = 0;
            }
        });
    }

    function aplicarVolumen() {
        if (activa) pistas[activa].volume = silenciado ? 0 :
            volumen * AUDIO_AJUSTES.musica[activa] * mezcla;
        for (const [nombre, grupo] of Object.entries(voces)) {
            for (const voz of grupo) voz.volume = silenciado ? 0 :
                volumen * AUDIO_AJUSTES.efectos[nombre];
        }
    }

    function actualizar(delta) {
        if (pausado) return;
        const paso = delta / AUDIO_AJUSTES.desvanecimiento;
        if (activa && (activa !== deseada || silenciado || volumen === 0)) {
            mezcla = Math.max(0, mezcla - paso);
            if (mezcla === 0) {
                pistas[activa].pause();
                activa = null;
            }
        }
        if (!activa && deseada && desbloqueado && !silenciado && volumen > 0) {
            activa = deseada;
            mezcla = 0;
            reproducir(pistas[activa]);
        }
        if (activa && activa === deseada && !silenciado && volumen > 0)
            mezcla = Math.min(1, mezcla + paso);
        aplicarVolumen();
    }

    function desbloquear() {
        desbloqueado = true; // Llamar solo desde click/input del usuario.
        if (!pausado) actualizar(0.016);
    }

    function establecerVolumen(valor) {
        volumen = THREE.MathUtils.clamp(valor, 0, 1);
        guardar();
        aplicarVolumen();
        if (desbloqueado && !pausado) actualizar(0.016);
    }

    function alternarSilencio() {
        silenciado = !silenciado;
        guardar();
        if (!silenciado) desbloquear();
        aplicarVolumen();
    }

    function musica(nombre) { deseada = nombre; }

    function efecto(nombre) {
        if (!desbloqueado || silenciado || volumen === 0 || pausado) return;
        const voz = voces[nombre]?.find(elemento => elemento.paused || elemento.ended);
        if (!voz) return; // Límite de mezcla; no cortar disparos que aún suenan.
        voz.currentTime = 0;
        voz.volume = volumen * AUDIO_AJUSTES.efectos[nombre];
        reproducir(voz);
    }

    function detenerEfectos() {
        for (const grupo of Object.values(voces)) for (const voz of grupo) {
            voz.pause();
            voz.currentTime = 0;
        }
    }

    function detenerEfecto(nombre) {
        for (const voz of voces[nombre] || []) {
            voz.pause();
            voz.currentTime = 0;
        }
    }

    function pausar() {
        pausado = true;
        if (activa) pistas[activa].pause();
        detenerEfectos();
    }

    function reanudar() {
        pausado = false;
        if (activa && desbloqueado && !silenciado && volumen > 0)
            reproducir(pistas[activa]);
    }

    return { actualizar, desbloquear, establecerVolumen, alternarSilencio,
        musica, efecto, detenerEfectos, detenerEfecto, pausar, reanudar,
        get volumen() { return volumen; },
        get silenciado() { return silenciado; },
        get desbloqueado() { return desbloqueado; } };
}
