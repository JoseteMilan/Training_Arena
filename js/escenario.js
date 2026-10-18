"use strict";

// Parámetros visuales independientes de la cámara, las colisiones y el juego.
const ESTADIO_VISUAL = {
    halo: false,
    bloom: false, // Comparación directa: true activa el pase selectivo corregido.
    bloomStrength: 0.32,
    bloomRadius: 0.18,
    bloomThreshold: 0.88,
    resolucionBloom: 0.5,
    exposure: 0.92,
    ambientIntensity: 0.28,
    intensidadHemisferio: 0.2,
    accentLightIntensity: 0.65,
    mainLightIntensity: 1.05,
    emissiveIntensity: 0.18,
    intensidadAlerta: 0.18,
    calidadSombras: 2048,
    suavidadSombras: 2.4,
    pulsoAlerta: 0.16,
    colores: [
        { foco: 0xdaf5ff, lateral: 0x27cfff, contraste: 0xffad55 },
        { foco: 0xffd19a, lateral: 0x4799d9, contraste: 0xffa544 },
        { foco: 0xe5f2ff, lateral: 0xff465b, contraste: 0xffa145 }
    ],
    radioGradas: 27,
    radioCubierta: 43
};

// Escenario visual de la instalación. Las piezas del suelo y del perímetro
// viven toda la partida; solo la decoración temática cambia entre niveles.
function crearEscenarioVisual(scene, tamano, texturaMetal) {
    const cubo = new THREE.BoxGeometry(1, 1, 1);
    const aristasCubo = new THREE.EdgesGeometry(cubo, 25);
    const cilindro = new THREE.CylinderGeometry(0.12, 0.12, 1, 8);
    const geoRotulo = new THREE.PlaneGeometry(1, 1);
    const oscuro = new THREE.MeshPhongMaterial({ color: 0x111b26, shininess: 22 });
    const estructura = new THREE.MeshPhongMaterial({ color: 0x2d4659, shininess: 42 });
    const placaClara = new THREE.MeshPhongMaterial({ color: 0x607988, shininess: 55 });
    const placaOscura = new THREE.MeshPhongMaterial({ color: 0x273947, shininess: 26 });
    const pisoCentro = new THREE.MeshPhongMaterial({ color: 0x596c78, map: texturaMetal, shininess: 24 });
    const pisoBorde = new THREE.MeshPhongMaterial({ color: 0x354854, map: texturaMetal, shininess: 18 });
    const pisoEmblema = new THREE.MeshPhongMaterial({ color: 0x263743, shininess: 28 });
    const acento = new THREE.MeshPhongMaterial({ color: 0x35cfff, emissive: 0x13718b,
        shininess: 45 });
    const acentoSecundario = new THREE.MeshPhongMaterial({ color: 0x176174,
        emissive: 0x052c35, shininess: 28 });
    const advertencia = new THREE.MeshPhongMaterial({ color: 0xf4bc4c, emissive: 0x4c2e08,
        shininess: 32 });
    const luzCalida = new THREE.MeshPhongMaterial({ color: 0xc89950,
        emissive: 0x503010, shininess: 28 });
    const halo = new THREE.MeshBasicMaterial({ color: 0x35cfff, transparent: true,
        opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false,
        side: THREE.DoubleSide });
    const grada = new THREE.MeshPhongMaterial({ color: 0x384b5a, side: THREE.DoubleSide,
        shininess: 48 });
    const gradaAlterna = new THREE.MeshPhongMaterial({ color: 0x263744, side: THREE.DoubleSide,
        shininess: 36 });
    const gradaFrente = new THREE.MeshPhongMaterial({ color: 0x1d2e39,
        side: THREE.DoubleSide, shininess: 30 });
    const aristas = new THREE.LineBasicMaterial({ color: 0x526c78 });
    const grupoBase = new THREE.Group();
    scene.add(grupoBase);
    let grupoNivel = null;
    const texturasNivel = [];
    const materialesNivel = [];
    const geometriasNivel = [];
    let faseLuz = 0;
    let nivelActivo = 0;

    function pieza(padre, material, x, y, z, ancho, alto, fondo, sombra = false) {
        const malla = new THREE.Mesh(cubo, material);
        malla.position.set(x, y, z);
        malla.scale.set(ancho, alto, fondo);
        malla.castShadow = sombra;
        malla.receiveShadow = true;
        if (material === acento || material === luzCalida ||
            material === advertencia || material === halo) malla.layers.enable(2);
        padre.add(malla);
        return malla;
    }

    function borde(padre, x, y, z, ancho, alto, fondo) {
        const lineas = new THREE.LineSegments(aristasCubo, aristas);
        lineas.position.set(x, y, z);
        lineas.scale.set(ancho, alto, fondo);
        padre.add(lineas);
    }

    function franja(padre, x, y, z, ancho, alto, fondo) {
        const conjunto = new THREE.Group();
        conjunto.position.set(x, y, z);
        padre.add(conjunto);
        if (ESTADIO_VISUAL.halo) {
            const brillo = pieza(conjunto, halo, 0, 0, 0, ancho + 0.16,
                Math.max(alto + 0.12, 0.13), fondo + 0.12);
            brillo.receiveShadow = false;
            brillo.renderOrder = 1;
        }
        pieza(conjunto, acentoSecundario, 0, 0, 0, ancho, alto, fondo);
        return conjunto;
    }

    function suelo() {
        // La superficie lógica continúa en Y=0. Solo hay relieves visuales
        // de pocos centímetros y ningún elemento entra en las colisiones.
        pieza(grupoBase, oscuro, 0, -0.325, 0, tamano, 0.65, tamano);
        for (let fila = 0; fila < 4; fila++) {
            for (let columna = 0; columna < 4; columna++) {
                const x = -13.5 + columna * 9;
                const z = -13.5 + fila * 9;
                const central = (fila === 1 || fila === 2) &&
                    (columna === 1 || columna === 2);
                const material = central ? pisoCentro : pisoBorde;
                const anchoPlaca = central ? 8.88 : 8.74;
                pieza(grupoBase, material, x, 0.0075, z,
                    anchoPlaca, 0.015, anchoPlaca);
                // Solo una unión corta en las placas exteriores rompe la
                // repetición sin competir con los objetivos de madera.
                if (!central && (fila + columna) % 2 === 0)
                    pieza(grupoBase, placaOscura, x, 0.017, z,
                        2.6, 0.004, 0.18);
            }
        }
        for (const v of [-15.9, 15.9]) {
            // Luz empotrada: no lleva volumen de halo sobre el pavimento.
            pieza(grupoBase, acentoSecundario, 0, 0.018, v, 31.8, 0.004, 0.045);
            pieza(grupoBase, acentoSecundario, v, 0.018, 0, 0.045, 0.004, 31.8);
        }
        // Cuatro rejillas cerca del perímetro, fuera de la posición inicial.
        for (const x of [-14.8, 14.8]) {
            for (const z of [-9, 9]) {
                pieza(grupoBase, oscuro, x, 0.019, z, 1.3, 0.006, 3.1);
                for (let ranura = -1; ranura <= 1; ranura++) {
                    pieza(grupoBase, placaClara, x + ranura * 0.3, 0.024,
                        z, 0.055, 0.004, 2.7);
                }
            }
        }
        // Isla central circular y dos marcas hexagonales identifican la arena.
        const isla = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6,
            0.006, 64), pisoEmblema);
        isla.position.y = 0.020;
        isla.receiveShadow = true;
        grupoBase.add(isla);
        for (const radio of [3.3, 6.1]) {
            const malla = new THREE.Mesh(new THREE.RingGeometry(radio,
                radio + 0.055, 6), acento);
            malla.rotation.x = -Math.PI / 2;
            malla.rotation.z = Math.PI / 6;
            malla.position.y = 0.026;
            malla.layers.enable(2);
            grupoBase.add(malla);
        }
        for (let sector = 0; sector < 6; sector++) {
            const a = sector * Math.PI / 3;
            const marca = pieza(grupoBase, acento, Math.sin(a) * 7.1, 0.025,
                Math.cos(a) * 7.1, 0.09, 0.004, 1.4);
            marca.rotation.y = a;
        }
    }

    function geometriaPanel() {
        // Perfil biselado extruido: un único panel repetido en los 24 módulos.
        const forma = new THREE.Shape();
        forma.moveTo(-2.66, 0.42);
        forma.lineTo(-2.66, 4.7);
        forma.lineTo(-2.24, 5.28);
        forma.lineTo(2.24, 5.28);
        forma.lineTo(2.66, 4.7);
        forma.lineTo(2.66, 0.42);
        forma.closePath();
        return new THREE.ExtrudeGeometry(forma, { depth: 0.28,
            bevelEnabled: false, steps: 1 });
    }

    function paredes() {
        const panelGeo = geometriaPanel();
        const bordePanelGeo = new THREE.EdgesGeometry(panelGeo, 28);
        for (let lado = 0; lado < 4; lado++) {
            const muro = new THREE.Group();
            muro.rotation.y = lado * Math.PI / 2;
            grupoBase.add(muro);
            pieza(muro, oscuro, 0, 3.1, tamano / 2 + 0.7,
                tamano + 1, 6.2, 1.1, true);
            for (let i = 0; i < 6; i++) {
                const x = -15 + i * 6;
                const panel = new THREE.Mesh(panelGeo, i % 2 ? placaOscura : estructura);
                panel.position.set(x, 0, tamano / 2 + 0.18);
                panel.castShadow = panel.receiveShadow = true;
                muro.add(panel);
                const contorno = new THREE.LineSegments(bordePanelGeo, aristas);
                contorno.position.copy(panel.position);
                muro.add(contorno);
                pieza(muro, oscuro, x, 2.95, tamano / 2 + 0.105,
                    4.5, 2.3, 0.11);
                // Caja retranqueada, aletas laterales y visera inclinada:
                // tres planos de profundidad en lugar de una fachada plana.
                pieza(muro, placaOscura, x, 2.98, tamano / 2 - 0.015,
                    3.65, 1.62, 0.1);
                for (const ladoAleta of [-1, 1]) {
                    const aleta = pieza(muro, i % 3 === 0 ? placaClara : estructura,
                        x + ladoAleta * 2.08, 2.9, tamano / 2 - 0.22,
                        0.24, 3.1, 0.38, true);
                    aleta.rotation.z = ladoAleta * 0.1;
                }
                pieza(muro, placaClara, x, 4.28, tamano / 2 + 0.06,
                    4.45, 0.11, 0.14);
                franja(muro, x, 4.57, tamano / 2 + 0.045,
                    3.8, 0.055, 0.1);
                // Placas inclinadas en la zona superior de cada módulo.
                const bisel = pieza(muro, placaOscura, x, 5.58,
                    tamano / 2 + 0.35, 4.6, 0.5, 0.38);
                bisel.rotation.x = -0.32;
                const visera = pieza(muro, estructura, x, 5.24,
                    tamano / 2 - 0.11, 4.25, 0.12, 0.58);
                visera.rotation.x = -0.32;
                pieza(muro, estructura, x, 0.35, tamano / 2 + 0.4,
                    5.65, 0.7, 0.65, true);
                if (i % 3 === 1) {
                    // Señal de mantenimiento cálida, distribuida con mesura.
                    pieza(muro, luzCalida, x, 1.12, tamano / 2 + 0.047,
                        0.9, 0.055, 0.045);
                }
            }
            for (let i = 0; i <= 6; i++) {
                const x = -18 + i * 6;
                pieza(muro, oscuro, x, 3.2, tamano / 2 + 0.5,
                    0.7, 6.4, 0.85, true);
                pieza(muro, placaClara, x, 3.2, tamano / 2 + 0.08,
                    0.14, 5.8, 0.065);
                pieza(muro, acento, x, 5.95, tamano / 2 + 0.06,
                    0.2, 0.36, 0.08);
            }
            pieza(muro, estructura, 0, 6.45, tamano / 2 + 0.5,
                tamano + 1, 0.62, 0.85, true);
            pieza(muro, oscuro, 0, 6.82, tamano / 2 + 0.9,
                tamano + 0.4, 0.14, 0.92, true);
            franja(muro, 0, 6.1, tamano / 2 + 0.06,
                tamano, 0.045, 0.08);
        }
    }

    function geometriaPilar() {
        const perfil = new THREE.Shape();
        perfil.moveTo(-1.15, 0);
        perfil.lineTo(-1.15, 3.2);
        perfil.lineTo(-0.82, 4.1);
        perfil.lineTo(-0.7, 13.2);
        perfil.lineTo(-1.05, 15.2);
        perfil.lineTo(1.05, 15.2);
        perfil.lineTo(0.7, 13.2);
        perfil.lineTo(0.82, 4.1);
        perfil.lineTo(1.15, 3.2);
        perfil.lineTo(1.15, 0);
        perfil.closePath();
        return new THREE.ExtrudeGeometry(perfil, { depth: 1.25,
            bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08,
            bevelSegments: 1 });
    }

    function gradasYTribunas() {
        // Cinco terrazas anulares dan profundidad al estadio sin ampliar el
        // área jugable. El radio interior supera las esquinas del cuadrado.
        for (let fila = 0; fila < 5; fila++) {
            const interior = ESTADIO_VISUAL.radioGradas + fila * 2.65;
            const exterior = interior + 2.58;
            const altura = 4.5 + fila * 1.75;
            const terraza = new THREE.Mesh(
                new THREE.RingGeometry(interior, exterior, 64),
                fila % 2 ? gradaAlterna : grada);
            terraza.rotation.x = -Math.PI / 2;
            terraza.position.y = altura;
            terraza.receiveShadow = true;
            grupoBase.add(terraza);
            const frente = new THREE.Mesh(new THREE.CylinderGeometry(
                interior, interior, 1.75, 64, 1, true), gradaFrente);
            frente.position.y = altura - 0.88;
            grupoBase.add(frente);
            const escalon = new THREE.Mesh(new THREE.TorusGeometry(
                interior + 0.28, 0.035, 6, 80), placaClara);
            escalon.rotation.x = Math.PI / 2;
            escalon.position.y = altura + 0.025;
            grupoBase.add(escalon);
            if (fila === 1 || fila === 3) {
                const barandilla = new THREE.Mesh(new THREE.TorusGeometry(
                    exterior - 0.18, 0.055, 6, 80), estructura);
                barandilla.rotation.x = Math.PI / 2;
                barandilla.position.y = altura + 0.65;
                grupoBase.add(barandilla);
            }
            // Pasillos radiales dividen los anillos en sectores reconocibles.
            for (let sector = 0; sector < 16; sector++) {
                const angulo = sector * Math.PI / 8;
                const pasillo = pieza(grupoBase, oscuro,
                    Math.sin(angulo) * (interior + 1.29), altura + 0.026,
                    Math.cos(angulo) * (interior + 1.29),
                    sector % 4 === 0 ? 0.52 : 0.2, 0.018, 2.46);
                pasillo.rotation.y = angulo;
            }
        }

        const pilarGeo = geometriaPilar();
        const aristasPilar = new THREE.EdgesGeometry(pilarGeo, 30);
        for (let sector = 0; sector < 12; sector++) {
            const angulo = sector * Math.PI / 6;
            const estructuraRadial = new THREE.Group();
            estructuraRadial.position.set(Math.sin(angulo) * 39, 0,
                Math.cos(angulo) * 39);
            estructuraRadial.rotation.y = angulo;
            grupoBase.add(estructuraRadial);
            const pilar = new THREE.Mesh(pilarGeo, sector % 3 === 0 ? placaClara : estructura);
            estructuraRadial.add(pilar);
            const contorno = new THREE.LineSegments(aristasPilar, aristas);
            estructuraRadial.add(contorno);
            for (const sentido of [-1, 1]) {
                const soporte = pieza(estructuraRadial, oscuro,
                    sentido * 1.15, 9.3, -0.4, 0.46, 8.5, 0.48);
                soporte.rotation.z = sentido * 0.27;
            }
            franja(estructuraRadial, 0, 11.6, -0.17, 0.2, 2.65, 0.07);
            pieza(estructuraRadial, placaOscura, 0, 15.5, 0.55, 3, 0.75, 2);
            pieza(estructuraRadial, luzCalida, 0, 14.4, -0.18,
                0.7, 0.1, 0.08);
        }

        // Arcos de acceso y aro perimetral, siempre fuera de la zona jugable.
        const arcoGeo = new THREE.TorusGeometry(3.7, 0.24, 8, 32, Math.PI);
        const arcoLuzGeo = new THREE.TorusGeometry(3.7, 0.045, 6, 32, Math.PI);
        for (let sector = 0; sector < 4; sector++) {
            const angulo = sector * Math.PI / 2;
            const acceso = new THREE.Group();
            acceso.position.set(Math.sin(angulo) * 31, 8.8,
                Math.cos(angulo) * 31);
            acceso.rotation.y = angulo;
            grupoBase.add(acceso);
            acceso.add(new THREE.Mesh(arcoGeo, placaClara));
            const iluminado = new THREE.Mesh(arcoLuzGeo, acento);
            iluminado.position.z = -0.12;
            iluminado.layers.enable(2);
            acceso.add(iluminado);
            for (const x of [-3.7, 3.7]) {
                pieza(acceso, estructura, x, -1.8, 0,
                    0.45, 3.6, 0.7);
            }
        }
    }

    function cubierta() {
        // Cubierta anular abierta. Ninguna pieza cruza el centro ni tapa la
        // línea de visión de la cámara situada a la altura de Ely.
        const radioExterior = ESTADIO_VISUAL.radioCubierta;
        const techo = new THREE.Mesh(new THREE.RingGeometry(29, radioExterior, 64),
            new THREE.MeshPhongMaterial({ color: 0x1b2a35,
                side: THREE.DoubleSide, shininess: 45 }));
        techo.rotation.x = -Math.PI / 2;
        techo.position.y = 17.1;
        grupoBase.add(techo);
        // Faldón interior: se ve desde el campo y da grosor al anillo.
        const faldon = new THREE.Mesh(new THREE.CylinderGeometry(
            29.15, 29.15, 1.8, 64, 1, true), oscuro);
        faldon.position.y = 16.1;
        grupoBase.add(faldon);
        for (const [radio, altura, grosor, material] of [
            [29, 15.5, 0.28, estructura],
            [30.1, 16.9, 0.065, acento],
            [radioExterior, 17.15, 0.4, placaClara]
        ]) {
            const aro = new THREE.Mesh(new THREE.TorusGeometry(
                radio, grosor, 8, 96), material);
            aro.rotation.x = Math.PI / 2;
            aro.position.y = altura;
            if (material === acento) aro.layers.enable(2);
            grupoBase.add(aro);
        }
        for (let sector = 0; sector < 16; sector++) {
            const angulo = sector * Math.PI / 8;
            const modulo = new THREE.Group();
            modulo.position.set(Math.sin(angulo) * 36, 16.75,
                Math.cos(angulo) * 36);
            modulo.rotation.y = angulo;
            grupoBase.add(modulo);
            pieza(modulo, estructura, 0, 0, 0, 0.48, 0.72, 14);
            pieza(modulo, placaOscura, 0, -0.37, 0,
                0.26, 0.1, 13.2);
            for (const lado of [-1, 1]) {
                const riostra = pieza(modulo, placaClara,
                    lado * 1.15, -1.15, -4.2, 0.18, 2.6, 0.24);
                riostra.rotation.z = lado * 0.6;
            }
            if (sector % 2 === 0) {
                const foco = new THREE.Mesh(new THREE.CylinderGeometry(
                    0.42, 0.55, 0.5, 12), placaClara);
                foco.position.set(Math.sin(angulo) * 30.4, 15.1,
                    Math.cos(angulo) * 30.4);
                grupoBase.add(foco);
                const marcoFoco = new THREE.Mesh(new THREE.TorusGeometry(
                    0.5, 0.08, 6, 16), estructura);
                marcoFoco.rotation.x = Math.PI / 2;
                marcoFoco.position.set(foco.position.x, 14.84, foco.position.z);
                grupoBase.add(marcoFoco);
                const lente = new THREE.Mesh(new THREE.CircleGeometry(0.38, 12), acento);
                lente.rotation.x = Math.PI / 2;
                lente.position.set(foco.position.x, 14.84, foco.position.z);
                lente.layers.enable(2);
                grupoBase.add(lente);
                // Cada segunda luminaria es decorativa; solo cuatro focos
                // calculan iluminación real sobre la pista.
                pieza(grupoBase, luzCalida,
                    foco.position.x * 1.025, 15.28,
                    foco.position.z * 1.025, 0.18, 0.12, 0.18);
            }
        }
    }

    function exterior() {
        // Textura de horizonte procedimental: no requiere descargas ni shaders.
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        const gradiente = ctx.createLinearGradient(0, 0, 0, 256);
        gradiente.addColorStop(0, "#0a1322");
        gradiente.addColorStop(0.55, "#17293a");
        gradiente.addColorStop(1, "#263a49");
        ctx.fillStyle = gradiente;
        ctx.fillRect(0, 0, 512, 256);
        ctx.fillStyle = "#304a5b";
        for (let i = 0; i < 48; i++) {
            const x = i * 11;
            const alto = 20 + (i * 37 % 60);
            ctx.fillRect(x, 224 - alto, 5 + i % 4, alto);
        }
        const textura = new THREE.CanvasTexture(canvas);
        textura.encoding = THREE.sRGBEncoding;
        const horizonte = new THREE.Mesh(
            new THREE.CylinderGeometry(68, 68, 48, 64, 1, true),
            new THREE.MeshBasicMaterial({ map: textura, side: THREE.BackSide,
                depthWrite: false, fog: false }));
        horizonte.position.y = 19;
        grupoBase.add(horizonte);
        gradasYTribunas();
        cubierta();
        // Un segundo perfil lejano continúa la estructura más allá de las
        // gradas, visible entre el anillo y el horizonte sin cargar la pista.
        for (let sector = 0; sector < 20; sector++) {
            const angulo = sector * Math.PI / 10;
            const torre = new THREE.Mesh(cubo, sector % 4 === 0
                ? estructura : oscuro);
            torre.position.set(Math.sin(angulo) * 49,
                7 + (sector % 3) * 1.25, Math.cos(angulo) * 49);
            torre.scale.set(1.2, 14 + (sector % 3) * 2.5, 1.2);
            grupoBase.add(torre);
        }
        scene.fog = new THREE.Fog(0x17293a, 52, 95);
        scene.background = new THREE.Color(0x0a1322);
    }

    const ambiente = new THREE.AmbientLight(0xd8e7f4,
        ESTADIO_VISUAL.ambientIntensity);
    const hemisferio = new THREE.HemisphereLight(0xb6d9ed, 0x1c2934,
        ESTADIO_VISUAL.intensidadHemisferio);
    const principal = new THREE.DirectionalLight(0xffebd2,
        ESTADIO_VISUAL.mainLightIntensity);
    principal.position.set(-16, 28, 12);
    principal.castShadow = true;
    principal.shadow.mapSize.set(ESTADIO_VISUAL.calidadSombras,
        ESTADIO_VISUAL.calidadSombras);
    // Concentrar el mapa de sombras en la arena mejora la nitidez sin subir
    // su resolución ni activar sombras en los focos ornamentales.
    const extension = tamano * 0.8;
    Object.assign(principal.shadow.camera, { left: -extension, right: extension,
        top: extension, bottom: -extension, near: 1, far: 90 });
    principal.shadow.camera.updateProjectionMatrix();
    principal.shadow.bias = -0.00015;
    principal.shadow.normalBias = 0.02;
    principal.shadow.radius = ESTADIO_VISUAL.suavidadSombras;
    scene.add(ambiente, hemisferio, principal);
    // Las luces también deben estar en la capa del pase selectivo para que
    // sus franjas Phong con emisivo conserven el color en el bloom.
    ambiente.layers.enable(2);
    hemisferio.layers.enable(2);
    principal.layers.enable(2);
    const focos = [];
    for (const x of [-14, 14]) {
        for (const z of [-14, 14]) {
            const foco = new THREE.SpotLight(0x35cfff,
                ESTADIO_VISUAL.accentLightIntensity, 42, Math.PI / 7, 0.48, 1.2);
            foco.position.set(x * 1.52, 16.1, z * 1.52);
            foco.target.position.set(x * 0.45, 0, z * 0.45);
            foco.layers.enable(2);
            scene.add(foco, foco.target);
            focos.push(foco);
        }
    }
    // Dos reflejos cálidos en muros opuestos recortan la silueta fría de
    // personajes y paneles sin crear más mapas de sombra.
    const lucesPerimetro = [];
    for (const x of [-1, 1]) {
        const luz = new THREE.PointLight(0xffa45a, 0.12, 13, 2);
        luz.position.set(x * 16.2, 5.5, -9);
        luz.layers.enable(2);
        scene.add(luz);
        lucesPerimetro.push(luz);
    }

    function pantalla(texto, sector, x, z, giro, ancho, colorHex) {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        const fondo = ctx.createLinearGradient(0, 0, 1024, 256);
        fondo.addColorStop(0, "#091824");
        fondo.addColorStop(1, "#22394a");
        ctx.fillStyle = fondo;
        ctx.fillRect(0, 0, 1024, 256);
        ctx.strokeStyle = "#7c9cad";
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, 1008, 240);
        ctx.fillStyle = "#3f6275";
        for (let i = 0; i < 7; i++) {
            ctx.fillRect(760 + i * 33, 90 + (i % 3) * 12, 15, 115 - (i % 3) * 12);
        }
        ctx.fillStyle = "#b6d6e5";
        ctx.font = "bold 27px Segoe UI, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`SECTOR ${sector}  /  COMBAT SIMULATION`, 58, 55);
        ctx.fillStyle = "#f2f8fa";
        ctx.font = "bold 68px Segoe UI, sans-serif";
        ctx.fillText(texto.toUpperCase(), 58, 151, 800);
        ctx.fillStyle = "#9bbbc8";
        ctx.font = "27px Segoe UI, sans-serif";
        ctx.fillText("ARENA STATUS  /  ACTIVE", 60, 211);
        const tinta = `#${colorHex.toString(16).padStart(6, "0")}`;
        ctx.fillStyle = tinta;
        ctx.fillRect(22, 20, 11, 216);
        ctx.fillRect(58, 174, 550, 4);
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(839 + i * 29, 28, 17, 8);
        }
        const textura = new THREE.CanvasTexture(canvas);
        textura.encoding = THREE.sRGBEncoding;
        const material = new THREE.MeshBasicMaterial({ map: textura });
        material.color.setScalar(0.76);
        texturasNivel.push(textura);
        materialesNivel.push(material);
        const grupo = new THREE.Group();
        grupo.position.set(x, 8.6, z);
        grupo.rotation.y = giro;
        grupoNivel.add(grupo);
        const alto = ancho / 4;
        pieza(grupo, oscuro, 0, 0, -0.13, ancho + 0.55, alto + 0.55, 0.35);
        borde(grupo, 0, 0, -0.13, ancho + 0.55, alto + 0.55, 0.35);
        pieza(grupo, estructura, 0, alto / 2 + 0.23, -0.15,
            ancho + 0.9, 0.28, 0.6);
        for (const lado of [-1, 1]) {
            pieza(grupo, placaClara, lado * (ancho / 2 + 0.22), 0,
                -0.11, 0.22, alto + 0.6, 0.49);
            pieza(grupo, acento, lado * (ancho / 2 + 0.23),
                alto / 2 - 0.12, 0.16, 0.12, 0.12, 0.04);
        }
        const malla = new THREE.Mesh(geoRotulo, material);
        malla.scale.set(ancho, alto, 1);
        malla.position.z = 0.09;
        malla.layers.enable(2);
        grupo.add(malla);
        franja(grupo, 0, -alto / 2 - 0.2, 0.06, ancho + 0.6, 0.06, 0.1);
        for (const lateral of [-1, 1]) {
            pieza(grupo, estructura, lateral * (ancho / 2 - 0.3),
                -alto / 2 - 1.4, -0.24, 0.35, 2.5, 0.55);
        }
    }

    function pantallasNivel(texto, color) {
        pantalla(texto, "01", 0, -21, 0, 10, color);
        pantalla(texto, "02", 21, 0, -Math.PI / 2, 7.6, color);
        pantalla(texto, "03", -21, 0, Math.PI / 2, 7.6, color);
    }

    function marcasSuelo(material, nivel) {
        // Señalización casi coplanaria; las cajas y el movimiento conservan
        // exactamente las mismas posiciones y colisiones.
        for (const x of [-11, 11]) {
            for (let i = -2; i <= 2; i++) {
                pieza(grupoNivel, material, x, 0.02, i * 5.1,
                    nivel === 0 ? 0.07 : 0.22, 0.004, 1.4);
            }
        }
        if (nivel === 0) {
            const aroGeo = new THREE.RingGeometry(2.8, 2.84, 48);
            const aro = new THREE.Mesh(aroGeo, material);
            aro.rotation.x = -Math.PI / 2;
            aro.position.set(0, 0.023, 1);
            grupoNivel.add(aro);
            // Esta geometría es propia del nivel; se libera al cambiarlo.
            geometriasNivel.push(aroGeo);
        } else {
            for (const z of [-15, 15]) {
                for (let i = -6; i <= 6; i++) {
                    const raya = pieza(grupoNivel, material, i * 2.2, 0.021,
                        z, 0.7, 0.004, 0.12);
                    raya.rotation.y = -0.4;
                }
            }
        }
    }

    function senalarObstaculos(configuracion, material) {
        for (const [x, z, ancho, fondo, , giro = 0] of configuracion) {
            const girado = Math.abs(Math.sin(giro)) > 0.5;
            const semiancho = (girado ? fondo : ancho) / 2;
            const semifondo = (girado ? ancho : fondo) / 2;
            for (const lado of [-1, 1]) {
                for (let i = -2; i <= 2; i++) {
                    const raya = pieza(grupoNivel, material, x + i * 0.38,
                        0.022, z + lado * (semifondo + 0.42),
                        0.16, 0.004, 0.5);
                    raya.rotation.y = -0.55;
                }
                pieza(grupoNivel, material, x + lado * (semiancho + 0.38),
                    0.022, z, 0.07, 0.004, semifondo * 2 + 0.7);
            }
        }
    }

    function decoracionEntrenamiento() {
        const aroGeo = new THREE.TorusGeometry(0.85, 0.065, 8, 24);
        geometriasNivel.push(aroGeo);
        for (const x of [-7, 0, 7]) {
            const panel = new THREE.Group();
            panel.position.set(x, 10.1, -30);
            grupoNivel.add(panel);
            pieza(panel, oscuro, 0, 0, -0.16, 2.2, 2.2, 0.25);
            panel.add(new THREE.Mesh(aroGeo, acento));
            pieza(panel, acento, 0, 0, 0.05, 0.045, 1.2, 0.04);
            pieza(panel, acento, 0, 0, 0.05, 1.2, 0.045, 0.04);
        }
    }

    function decoracionIndustrial(obstaculos) {
        for (const lado of [0, 2]) {
            const grupo = new THREE.Group();
            grupo.rotation.y = lado * Math.PI / 2;
            grupoNivel.add(grupo);
            for (const y of [2.25, 3.05]) {
                const tubo = new THREE.Mesh(cilindro, placaClara);
                tubo.scale.y = 32;
                tubo.rotation.z = Math.PI / 2;
                tubo.position.set(0, y, tamano / 2 + 0.2);
                grupo.add(tubo);
            }
            for (const x of [-12, -6, 0, 6, 12]) {
                pieza(grupo, oscuro, x, 2.65, tamano / 2 + 0.28,
                    0.36, 1.3, 0.32);
                pieza(grupo, acento, x, 2.65, tamano / 2 + 0.06,
                    0.1, 0.75, 0.04);
            }
        }
        // Dos pasarelas exteriores refuerzan el carácter industrial de esta zona.
        for (const lado of [0, 2]) {
            const pasarela = new THREE.Group();
            pasarela.position.set(0, 0, lado === 0 ? 33 : -33);
            pasarela.rotation.y = lado * Math.PI / 2;
            grupoNivel.add(pasarela);
            pieza(pasarela, estructura, 0, 10.6, 0, 13, 0.55, 1.1);
            for (const x of [-6, 6]) {
                pieza(pasarela, placaClara, x, 8.9, 0, 0.65, 3.4, 0.8);
                const diagonal = pieza(pasarela, oscuro, x * 0.68,
                    9.6, -0.38, 0.25, 2.3, 0.28);
                diagonal.rotation.z = x < 0 ? -0.65 : 0.65;
            }
            franja(pasarela, 0, 10.2, -0.59, 11.8, 0.075, 0.06);
        }
        senalarObstaculos(obstaculos, advertencia);
    }

    function decoracionPeligro(obstaculos) {
        for (let lado = 0; lado < 4; lado++) {
            const grupo = new THREE.Group();
            grupo.rotation.y = lado * Math.PI / 2;
            grupoNivel.add(grupo);
            for (const x of [-12, 0, 12]) {
                for (const sentido of [-1, 1]) {
                    const refuerzo = pieza(grupo, placaClara, x + sentido * 1.25,
                        3.25, tamano / 2 + 0.28, 0.25, 3.7, 0.28);
                    refuerzo.rotation.z = sentido * 0.45;
                }
                pieza(grupo, acento, x, 5.62, tamano / 2 + 0.06,
                    0.8, 0.28, 0.12);
            }
        }
        // Cuatro cuchillas visuales de alarma cuelgan de la cubierta exterior.
        for (let sector = 0; sector < 4; sector++) {
            const angulo = sector * Math.PI / 2 + Math.PI / 4;
            const alarma = new THREE.Group();
            alarma.position.set(Math.sin(angulo) * 32, 0,
                Math.cos(angulo) * 32);
            alarma.rotation.y = angulo;
            grupoNivel.add(alarma);
            for (const lado of [-1, 1]) {
                const brazo = pieza(alarma, estructura, lado * 2.4,
                    12.2, 0, 0.55, 5.8, 0.65);
                brazo.rotation.z = lado * 0.42;
                franja(alarma, lado * 2.4, 12.2, -0.38,
                    0.14, 3.5, 0.06).rotation.z = lado * 0.42;
            }
            pieza(alarma, advertencia, 0, 9.9, -0.44, 1.5, 0.25, 0.08);
        }
        senalarObstaculos(obstaculos, advertencia);
    }

    function cambiarNivel(indice, nivel) {
        if (grupoNivel) {
            scene.remove(grupoNivel);
            for (const geo of geometriasNivel) geo.dispose();
            for (const material of materialesNivel) material.dispose();
            for (const textura of texturasNivel) textura.dispose();
            geometriasNivel.length = materialesNivel.length = texturasNivel.length = 0;
        }
        nivelActivo = indice;
        faseLuz = 0;
        grupoNivel = new THREE.Group();
        scene.add(grupoNivel);
        const color = new THREE.Color(nivel.acento);
        const paleta = ESTADIO_VISUAL.colores[indice];
        acento.color.copy(color);
        acento.emissive.copy(color).multiplyScalar(ESTADIO_VISUAL.emissiveIntensity);
        acentoSecundario.color.copy(color).multiplyScalar(0.48);
        acentoSecundario.emissive.copy(color).multiplyScalar(
            ESTADIO_VISUAL.emissiveIntensity * 0.28);
        halo.color.copy(color);
        principal.color.setHex(paleta.foco);
        for (let i = 0; i < focos.length; i++) {
            const foco = focos[i];
            foco.color.setHex(i % 2 ? paleta.foco : paleta.lateral);
            foco.intensity = ESTADIO_VISUAL.accentLightIntensity;
        }
        for (const luz of lucesPerimetro) {
            luz.color.setHex(paleta.contraste);
            luz.intensity = indice === 1 ? 0.2 : 0.12;
        }
        advertencia.emissive.setHex(0x4c2e08);
        ambiente.intensity = ESTADIO_VISUAL.ambientIntensity *
            (indice === 2 ? 0.85 : 1);
        hemisferio.intensity = ESTADIO_VISUAL.intensidadHemisferio *
            (indice === 2 ? 0.9 : 1);
        principal.intensity = ESTADIO_VISUAL.mainLightIntensity *
            (indice === 2 ? 0.9 : 1);
        pisoCentro.color.setHex(indice === 2 ? 0x4a5965 : 0x596c78);
        pisoBorde.color.setHex(indice === 1 ? 0x3d4041 : 0x354854);
        pisoEmblema.color.setHex(indice === 1 ? 0x302e2e :
            indice === 2 ? 0x30262d : 0x263743);
        pantallasNivel(nivel.nombre, nivel.acento);
        marcasSuelo(acento, indice);
        if (indice === 0) decoracionEntrenamiento();
        if (indice === 1) decoracionIndustrial(nivel.obstaculos);
        if (indice === 2) decoracionPeligro(nivel.obstaculos);
    }

    function actualizar(delta) {
        faseLuz += delta;
        if (ESTADIO_VISUAL.halo) halo.opacity = 0.035 + 0.005 * Math.sin(faseLuz * 1.6);
        const brilloPantalla = 0.76 + 0.018 * Math.sin(faseLuz * 1.35);
        for (const material of materialesNivel) material.color.setScalar(brilloPantalla);
        if (nivelActivo !== 2) return;
        const pulso = 1 - ESTADIO_VISUAL.pulsoAlerta / 2 +
            ESTADIO_VISUAL.pulsoAlerta / 2 * Math.sin(faseLuz * 3.2);
        for (const foco of focos) foco.intensity = ESTADIO_VISUAL.accentLightIntensity * pulso;
        acento.emissive.setHex(0xff5365).multiplyScalar(
            ESTADIO_VISUAL.emissiveIntensity * pulso);
        const alerta = 1 + ESTADIO_VISUAL.intensidadAlerta *
            Math.sin(faseLuz * 2.4);
        advertencia.emissive.setHex(0x8b390b).multiplyScalar(alerta);
        for (const luz of lucesPerimetro) luz.intensity = 0.12 * alerta;
    }

    // Bloom selectivo opcional. El color base y el resplandor se combinan
    // antes de la codificación sRGB final; así no se suman dos imágenes ya
    // codificadas ni se dibuja la escena dos veces sobre el canvas.
    let bloom = null;
    function crearBloom() {
        const opciones = { minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter, format: THREE.RGBAFormat,
            depthBuffer: false, stencilBuffer: false };
        const base = new THREE.WebGLRenderTarget(1, 1,
            { ...opciones, depthBuffer: true });
        const fuente = new THREE.WebGLRenderTarget(1, 1,
            { ...opciones, depthBuffer: true });
        const horizontal = new THREE.WebGLRenderTarget(1, 1, opciones);
        const vertical = new THREE.WebGLRenderTarget(1, 1, opciones);
        const escenaPlano = new THREE.Scene();
        const camaraPlano = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const vertice = `varying vec2 uvPantalla;
            void main() { uvPantalla = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
        const desenfoque = new THREE.ShaderMaterial({
            uniforms: {
                mapa: { value: null }, paso: { value: new THREE.Vector2() },
                umbral: { value: ESTADIO_VISUAL.bloomThreshold },
                extraer: { value: 1 }
            },
            vertexShader: vertice,
            fragmentShader: `uniform sampler2D mapa;
                uniform vec2 paso; uniform float umbral; uniform float extraer;
                varying vec2 uvPantalla;
                vec3 muestra(vec2 uv) {
                    vec3 color = texture2D(mapa, uv).rgb;
                    float brillo = max(max(color.r, color.g), color.b);
                    return mix(color, color * smoothstep(umbral,
                        umbral + 0.22, brillo), extraer);
                }
                void main() {
                    vec3 color = muestra(uvPantalla) * 0.4;
                    color += muestra(uvPantalla + paso * 1.5) * 0.24;
                    color += muestra(uvPantalla - paso * 1.5) * 0.24;
                    color += muestra(uvPantalla + paso * 3.5) * 0.06;
                    color += muestra(uvPantalla - paso * 3.5) * 0.06;
                    gl_FragColor = vec4(color, 1.0);
                }`,
            depthTest: false, depthWrite: false, toneMapped: false
        });
        const suma = new THREE.ShaderMaterial({
            uniforms: { base: { value: base.texture },
                mapa: { value: vertical.texture },
                intensidad: { value: ESTADIO_VISUAL.bloomStrength } },
            vertexShader: vertice,
            fragmentShader: `uniform sampler2D base; uniform sampler2D mapa;
                uniform float intensidad;
                varying vec2 uvPantalla;
                void main() {
                    vec3 color = texture2D(base, uvPantalla).rgb +
                        texture2D(mapa, uvPantalla).rgb * intensidad;
                    gl_FragColor = vec4(min(color, vec3(1.0)), 1.0);
                    #include <encodings_fragment>
                }`,
            blending: THREE.NoBlending,
            depthTest: false, depthWrite: false, toneMapped: false
        });
        const plano = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), desenfoque);
        plano.frustumCulled = false;
        escenaPlano.add(plano);
        return { base, fuente, horizontal, vertical, escenaPlano, camaraPlano,
            plano, desenfoque, suma, ancho: 0, alto: 0,
            tamano: new THREE.Vector2(), colorPrevio: new THREE.Color(),
            fondoNegro: new THREE.Color(0x000000) };
    }

    function renderizar(renderer, escena, camara) {
        if (!ESTADIO_VISUAL.bloom) {
            renderer.render(escena, camara);
            return;
        }
        if (!bloom) bloom = crearBloom();
        renderer.getDrawingBufferSize(bloom.tamano);
        const anchoBase = Math.max(1, Math.floor(bloom.tamano.x));
        const altoBase = Math.max(1, Math.floor(bloom.tamano.y));
        const ancho = Math.max(1, Math.floor(bloom.tamano.x *
            ESTADIO_VISUAL.resolucionBloom));
        const alto = Math.max(1, Math.floor(bloom.tamano.y *
            ESTADIO_VISUAL.resolucionBloom));
        if (anchoBase !== bloom.base.width || altoBase !== bloom.base.height)
            bloom.base.setSize(anchoBase, altoBase);
        if (ancho !== bloom.ancho || alto !== bloom.alto) {
            for (const destino of [bloom.fuente, bloom.horizontal, bloom.vertical])
                destino.setSize(ancho, alto);
            bloom.ancho = ancho;
            bloom.alto = alto;
        }
        const destinoPrevio = renderer.getRenderTarget();
        const borradoPrevio = renderer.autoClear;
        const sombrasPrevias = renderer.shadowMap.autoUpdate;
        const alfaPrevio = renderer.getClearAlpha();
        renderer.getClearColor(bloom.colorPrevio);
        const fondoPrevio = escena.background;
        const nieblaPrevia = escena.fog;
        const capasPrevias = camara.layers.mask;
        try {
            renderer.autoClear = true;
            renderer.setRenderTarget(bloom.base);
            renderer.render(escena, camara);
            escena.background = bloom.fondoNegro;
            escena.fog = null;
            camara.layers.set(2);
            renderer.shadowMap.autoUpdate = false;
            renderer.autoClear = true;
            renderer.setClearColor(0x000000, 1);
            renderer.setRenderTarget(bloom.fuente);
            renderer.clear();
            renderer.render(escena, camara);
            camara.layers.mask = capasPrevias;
            escena.background = fondoPrevio;
            escena.fog = nieblaPrevia;

            bloom.plano.material = bloom.desenfoque;
            const uniformes = bloom.desenfoque.uniforms;
            uniformes.umbral.value = ESTADIO_VISUAL.bloomThreshold;
            uniformes.extraer.value = 1;
            uniformes.mapa.value = bloom.fuente.texture;
            const radio = 0.5 + ESTADIO_VISUAL.bloomRadius * 2;
            uniformes.paso.value.set(radio / ancho, 0);
            renderer.setRenderTarget(bloom.horizontal);
            renderer.render(bloom.escenaPlano, bloom.camaraPlano);
            uniformes.extraer.value = 0;
            uniformes.mapa.value = bloom.horizontal.texture;
            uniformes.paso.value.set(0, radio / alto);
            renderer.setRenderTarget(bloom.vertical);
            renderer.render(bloom.escenaPlano, bloom.camaraPlano);

            bloom.suma.uniforms.intensidad.value = ESTADIO_VISUAL.bloomStrength;
            bloom.plano.material = bloom.suma;
            renderer.setRenderTarget(destinoPrevio);
            renderer.autoClear = true;
            renderer.render(bloom.escenaPlano, bloom.camaraPlano);
        } finally {
            camara.layers.mask = capasPrevias;
            escena.background = fondoPrevio;
            escena.fog = nieblaPrevia;
            renderer.shadowMap.autoUpdate = sombrasPrevias;
            renderer.autoClear = borradoPrevio;
            renderer.setClearColor(bloom.colorPrevio, alfaPrevio);
            renderer.setRenderTarget(destinoPrevio);
        }
    }

    function crearBarricada(ancho, fondo, alto) {
        // Todo queda dentro del AABB físico existente del obstáculo.
        const grupo = new THREE.Group();
        pieza(grupo, oscuro, 0, 0.12, 0, ancho, 0.24, fondo);
        pieza(grupo, estructura, 0, alto / 2, 0,
            ancho - 0.08, alto - 0.28, fondo - 0.08, true);
        for (const z of [-1, 1]) {
            pieza(grupo, placaOscura, 0, alto * 0.58,
                z * (fondo / 2 - 0.055), ancho - 0.25,
                alto * 0.52, 0.06);
            pieza(grupo, acento, 0, alto * 0.86,
                z * (fondo / 2 - 0.018), ancho - 0.45, 0.06, 0.02);
        }
        for (const x of [-1, 1]) {
            pieza(grupo, placaClara, x * (ancho / 2 - 0.12),
                alto / 2, 0, 0.19, alto - 0.13, fondo - 0.06);
        }
        pieza(grupo, placaClara, 0, alto - 0.07, 0,
            ancho, 0.14, fondo);
        borde(grupo, 0, alto / 2, 0, ancho, alto, fondo);
        return grupo;
    }

    suelo();
    paredes();
    exterior();
    return { cambiarNivel, actualizar, crearBarricada, renderizar };
}
